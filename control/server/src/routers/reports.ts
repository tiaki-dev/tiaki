import { z } from 'zod'
import { router, agentProcedure } from '../trpc.js'
import { upsertContainers, deleteStaleContainers } from '../db/queries/containers.js'
import {
  upsertUpdateResult,
  findApprovedCommandsByAgent,
  findRollbackCommandsByAgent,
  updateUpdateResultStatus,
  bulkSetDeploying,
} from '../db/queries/update-results.js'
import { findEnabledPoliciesForAgent } from '../db/queries/policies.js'
import { createAuditEntry } from '../db/queries/audit-log.js'
import { globMatch } from '../lib/glob.js'
import { newId } from '../lib/id.js'
import { getBumpType, isBumpAllowed, type MaxBump } from '../lib/semver.js'
import { getImageSourceUrl } from '../lib/image-source.js'
import { fetchReleaseNotes } from '../lib/release-notes.js'
import { summarizeReleaseNotes, truncateReleaseNotes } from '../lib/summarize.js'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { updateResults } from '../db/schema.js'

const containerReportSchema = z.object({
  containerId: z.string(),
  name: z.string(),
  image: z.string(),
  tag: z.string(),
  digest: z.string().optional(),
  composeFile: z.string().nullable().optional(),
  composeService: z.string().nullable().optional(),
  namespace: z.string().nullable().optional(),
})

const vulnerabilitySchema = z.object({
  id: z.string(),
  severity: z.string(),
  pkgName: z.string(),
  title: z.string(),
})

const updateReportSchema = z.object({
  containerId: z.string(), // Docker container ID (not our DB ID)
  currentTag: z.string(),
  latestTag: z.string(),
  latestDigest: z.string().optional(),
  changelogUrl: z.string().nullable().optional(),
  vulnerabilities: z.array(vulnerabilitySchema).optional(),
})

export const reportsRouter = router({
  /**
   * Agent submits scan results.
   * Upserts all reported containers, creates/updates update_results.
   */
  submit: agentProcedure
    .input(
      z.object({
        containers: z.array(containerReportSchema),
        updates: z.array(updateReportSchema).optional().default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const agentId = ctx.agentId!
      const now = new Date()

      // 1. Upsert containers
      const upserted = await upsertContainers(
        input.containers.map((c) => ({
          id: newId(),
          agentId,
          containerId: c.containerId,
          name: c.name,
          image: c.image,
          currentTag: c.tag,
          currentDigest: c.digest ?? null,
          composeFile: c.composeFile ?? null,
          composeService: c.composeService ?? null,
          namespace: c.namespace ?? null,
          lastScannedAt: now,
          createdAt: now,
        })),
      )

      // 2. Remove containers no longer running on this agent
      await deleteStaleContainers(
        agentId,
        input.containers.map((c) => c.containerId),
      )

      // 3. Upsert update results, collecting results for policy evaluation
      const containerMap = new Map(upserted.map((c) => [c.containerId, c]))
      const upsertedUpdates: Array<{ id: string; image: string; currentTag: string; latestTag: string; status: string; releaseSummary: string | null }> = []

      for (const u of input.updates) {
        const container = containerMap.get(u.containerId)
        if (!container) continue

        const result = await upsertUpdateResult({
          id: newId(),
          containerId: container.id,
          agentId,
          currentTag: u.currentTag,
          latestTag: u.latestTag,
          latestDigest: u.latestDigest ?? null,
          changelogUrl: u.changelogUrl ?? null,
          vulnerabilities: u.vulnerabilities ?? null,
          status: 'pending',
          foundAt: now,
        })
        upsertedUpdates.push({ id: result.id, image: container.image, currentTag: result.currentTag, latestTag: result.latestTag, status: result.status, releaseSummary: result.releaseSummary ?? null })
      }

      // 4. Evaluate policies: auto-approve pending updates that match a policy
      const activePolicies = await findEnabledPoliciesForAgent(agentId)
      if (activePolicies.length > 0) {
        for (const update of upsertedUpdates) {
          if (update.status !== 'pending') continue
          const subject = `${update.image}:${update.latestTag}`
          for (const policy of activePolicies) {
            if (policy.autoApprove && globMatch(policy.imagePattern, subject)) {
              const bump = getBumpType(update.currentTag, update.latestTag)
              const allowed = isBumpAllowed(bump, (policy.maxBump as MaxBump | null) ?? null)
              if (!allowed) break // policy matched but bump too large — leave pending
              await updateUpdateResultStatus(update.id, 'approved')
              await createAuditEntry({
                updateResultId: update.id,
                action: 'approved',
                actor: 'policy',
                detail: `auto-approved by policy "${policy.name}"${policy.maxBump ? ` (maxBump: ${policy.maxBump}, bump: ${bump})` : ''}`,
              })
              break // first matching policy wins
            }
          }
        }
      }

      // 5. Background: fetch release notes + optional LLM summary for new updates
      // Fire-and-forget — does not block the response
      for (const update of upsertedUpdates) {
        if (!update.releaseSummary) {
          void fetchAndStoreReleaseSummary(update.id, update.image, update.latestTag)
        }
      }

      return { ok: true }
    }),

  /**
   * Agent polls for pending deploy commands (long-poll).
   * Returns immediately with any approved updates for this agent.
   */
  getCommands: agentProcedure.query(async ({ ctx }) => {
    const agentId = ctx.agentId!
    const [commands, rollbacks] = await Promise.all([
      findApprovedCommandsByAgent(agentId),
      findRollbackCommandsByAgent(agentId),
    ])

    // Mark all fetched commands as deploying immediately so the UI shows progress
    const allIds = [
      ...commands.map((c) => c.updateResultId),
      ...rollbacks.map((r) => r.updateResultId),
    ]
    await bulkSetDeploying(allIds)

    return { commands, rollbacks }
  }),
})

/**
 * Background helper: fetch release notes for an update and store a short summary.
 * Runs after the submit response is sent — errors are logged but not propagated.
 */
async function fetchAndStoreReleaseSummary(
  updateResultId: string,
  image: string,
  latestTag: string,
): Promise<void> {
  console.log(`[release-notes] fetching for ${image}:${latestTag}`)
  try {
    const sourceUrl = await getImageSourceUrl(image, latestTag)
    if (!sourceUrl) {
      console.log(`[release-notes] no source URL found for ${image}:${latestTag}`)
      return
    }
    console.log(`[release-notes] source URL: ${sourceUrl}`)

    const release = await fetchReleaseNotes(sourceUrl, latestTag)
    if (!release || !release.body) {
      console.log(`[release-notes] no release body for ${image}:${latestTag} (release: ${JSON.stringify(release)})`)
      return
    }

    // Store changelogUrl if not already set
    const summary =
      (await summarizeReleaseNotes(release.body)) ?? truncateReleaseNotes(release.body)
    console.log(`[release-notes] summary stored for ${image}:${latestTag}`)

    await db
      .update(updateResults)
      .set({
        changelogUrl: release.url,
        releaseSummary: summary,
      })
      .where(eq(updateResults.id, updateResultId))
  } catch (err) {
    console.error(`[reports] release summary failed for ${image}:${latestTag}: ${err}`)
  }
}
