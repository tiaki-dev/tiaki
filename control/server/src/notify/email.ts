import nodemailer from 'nodemailer'
import type { UpdateResult } from '../db/schema.js'
import { renderUpdateNotificationEmail, renderTestEmail } from './email-template.js'
import { findContainerById } from '../db/queries/containers.js'
import { findAgentById } from '../db/queries/agents.js'

function createTransporter() {
  const host = process.env['SMTP_HOST']
  if (!host) return null

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: process.env['SMTP_USER']
      ? { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] }
      : undefined,
  })
}

export async function sendUpdateNotification(
  updates: UpdateResult[],
  recipient: string,
): Promise<void> {
  const transporter = createTransporter()
  if (!transporter) {
    console.warn('[email] SMTP not configured, skipping notification')
    return
  }

  // Enrich updates with container and agent information
  const enrichedUpdates = await Promise.all(
    updates.map(async (u) => {
      const container = await findContainerById(u.containerId)
      const agent = container ? await findAgentById(container.agentId) : null

      return {
        containerName: container?.name ?? u.containerId,
        image: container?.image ?? 'unknown',
        currentTag: u.currentTag,
        latestTag: u.latestTag,
        agentName: agent?.name ?? 'Unknown',
        vulnerabilities: u.vulnerabilities?.length ?? undefined,
        releaseNotes: u.releaseSummary ?? undefined,
      }
    }),
  )

  const controlPlaneUrl = process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3001'
  const html = renderUpdateNotificationEmail({
    updates: enrichedUpdates,
    controlPlaneUrl,
  })

  // Plain text fallback
  const lines = enrichedUpdates.map(
    (u) => `  • ${u.containerName} (${u.agentName}): ${u.currentTag} → ${u.latestTag}`,
  )
  const text = `The following container updates are available:\n\n${lines.join('\n')}\n\nLog in to Tiaki to review and approve: ${controlPlaneUrl}/updates`

  await transporter.sendMail({
    from: process.env['SMTP_FROM'] ?? 'tiaki@example.com',
    to: recipient,
    subject: `Tiaki: ${updates.length} container update${updates.length > 1 ? 's' : ''} available`,
    text,
    html,
  })
}

export async function sendTestEmail(recipient: string): Promise<void> {
  const transporter = createTransporter()
  if (!transporter) {
    throw new Error('SMTP is not configured')
  }

  const html = renderTestEmail()
  const text = 'This is a test email from Tiaki. Your SMTP configuration is working correctly.'

  await transporter.sendMail({
    from: process.env['SMTP_FROM'] ?? 'tiaki@example.com',
    to: recipient,
    subject: 'Tiaki: Test email',
    text,
    html,
  })
}
