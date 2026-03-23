import { useEffect, useRef, useState } from 'react'
import { trpc } from '../lib/trpc'
import { CheckCircle, XCircle, PlayCircle, Loader2, RotateCcw, ShieldAlert, ExternalLink, RefreshCw, ChevronDown } from 'lucide-react'
import { HostFilter } from '../components/HostFilter'
import Markdown from 'react-markdown'

type Vuln = { id: string; severity: string; pkgName: string; title: string }

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400',
  HIGH: 'bg-orange-500/20 text-orange-400',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400',
  LOW: 'bg-blue-500/20 text-blue-400',
  UNKNOWN: 'bg-gray-500/20 text-gray-400',
}
const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-400',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-blue-400',
  UNKNOWN: 'bg-gray-400',
}

function cveUrl(id: string): string {
  if (id.startsWith('GHSA-')) return `https://github.com/advisories/${id}`
  return `https://nvd.nist.gov/vuln/detail/${id}`
}

function CveBadge({ vulns }: { vulns: Vuln[] }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pos) return
    function onOutside(e: MouseEvent) {
      if (
        popRef.current && !popRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setPos(null)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [pos])

  if (!vulns || vulns.length === 0) return null
  const counts = vulns.reduce<Record<string, number>>((acc, v) => {
    acc[v.severity] = (acc[v.severity] ?? 0) + 1
    return acc
  }, {})
  const topSeverity = SEVERITY_ORDER.find((s) => counts[s])
  if (!topSeverity) return null

  const sorted = [...vulns].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )

  function toggle() {
    if (pos) { setPos(null); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX })
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer bg-muted hover:bg-muted/80 transition-all border border-border"
      >
        <ShieldAlert className={`w-3 h-3 ${(SEVERITY_COLORS[topSeverity] ?? '').split(' ')[1]}`} />
        {SEVERITY_ORDER.filter((s) => counts[s]).map((s) => (
          <span key={s} className={(SEVERITY_COLORS[s] ?? '').split(' ')[1]}>
            {counts[s]} {s}
          </span>
        ))}
      </button>

      {pos && (
        <div
          ref={popRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-50 w-80 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {vulns.length} Vulnerabilit{vulns.length !== 1 ? 'ies' : 'y'}
            </span>
            <div className="flex gap-2 text-xs text-muted-foreground">
              {SEVERITY_ORDER.filter((s) => counts[s]).map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[s]}`} />
                  {counts[s]} {s.charAt(0) + s.slice(1).toLowerCase()}
                </span>
              ))}
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto divide-y divide-border">
            {sorted.map((v) => (
              <li key={v.id} className="px-3 py-2 hover:bg-muted/40 transition-colors">
                <a
                  href={cveUrl(v.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-2 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[v.severity]}`} />
                      <span className="text-xs font-mono font-medium text-foreground group-hover:text-primary">
                        {v.id}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.pkgName} — {v.title}</p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function ReleaseNotesToggle({ summary, url }: { summary: string | null; url: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        Release notes
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline ml-1"
          >
            ↗
          </a>
        )}
      </button>
      {open && summary && (
        <div className="mt-2 pl-2 border-l border-border prose prose-invert prose-xs max-w-sm text-xs text-muted-foreground
          [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:leading-snug
          [&_strong]:text-foreground [&_p]:my-1 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
          <Markdown>{summary}</Markdown>
        </div>
      )}
    </div>
  )
}

type Status =
  | 'pending'
  | 'approved'
  | 'deploying'
  | 'deployed'
  | 'ignored'
  | 'failed'
  | 'rollback_requested'
  | 'rolled_back'

const STATUS_COLORS: Record<Status, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  approved: 'bg-blue-500/10 text-blue-400',
  deploying: 'bg-blue-500/20 text-blue-300',
  deployed: 'bg-green-500/10 text-green-400',
  ignored: 'bg-gray-500/10 text-gray-400',
  failed: 'bg-red-500/10 text-red-400',
  rollback_requested: 'bg-orange-500/10 text-orange-400',
  rolled_back: 'bg-purple-500/10 text-purple-400',
}

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pending',
  approved: 'Approved',
  deploying: 'Deploying…',
  deployed: 'Deployed',
  ignored: 'Ignored',
  failed: 'Failed',
  rollback_requested: 'Rollback queued',
  rolled_back: 'Rolled back',
}

const FILTERS: Array<Status | undefined> = [
  undefined, 'pending', 'approved', 'deploying', 'deployed', 'ignored', 'failed',
]

const FILTER_LABELS: Record<string, string> = {
  undefined: 'All',
  pending: 'Pending',
  approved: 'Approved',
  deploying: 'Deploying',
  deployed: 'Deployed',
  ignored: 'Ignored',
  failed: 'Failed',
}

export default function UpdatesPage() {
  const [filter, setFilter] = useState<Status | undefined>(undefined)
  const [agentId, setAgentId] = useState<string | undefined>()
  const { data: updates, refetch } = trpc.updates.list.useQuery(
    { status: filter, agentId },
  )

  const approve = trpc.updates.approve.useMutation({ onSuccess: () => refetch() })
  const ignore = trpc.updates.ignore.useMutation({ onSuccess: () => refetch() })
  const unignore = trpc.updates.unignore.useMutation({ onSuccess: () => refetch() })
  const deploy = trpc.updates.triggerDeploy.useMutation({ onSuccess: () => refetch() })
  const rollback = trpc.updates.rollback.useMutation({ onSuccess: () => refetch() })

  // Auto-refresh while any update is deploying
  const hasDeploying = updates?.some((u) => u.status === 'deploying' || u.status === 'rollback_requested')
  useEffect(() => {
    if (!hasDeploying) return
    const id = setInterval(() => refetch(), 3000)
    return () => clearInterval(id)
  }, [hasDeploying, refetch])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Updates</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <HostFilter value={agentId} onChange={setAgentId} />
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={String(f)}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {FILTER_LABELS[String(f)]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left p-3">Host</th>
              <th className="text-left p-3">Container</th>
              <th className="text-left p-3">Current</th>
              <th className="text-left p-3">Latest</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Found</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {updates?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  No updates found.
                </td>
              </tr>
            )}
            {updates?.map((u) => {
              const status = u.status as Status
              return (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="p-3 text-xs text-muted-foreground">{u.agentName}</td>
                  <td className="p-3">
                    <div className="font-medium text-xs">{u.containerName || u.containerId.slice(0, 12)}</div>
                    {(u.releaseSummary || u.changelogUrl) && (
                      <ReleaseNotesToggle summary={u.releaseSummary ?? null} url={u.changelogUrl ?? null} />
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{u.currentTag}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">{u.latestTag}</span>
                      <CveBadge vulns={(u.vulnerabilities as Vuln[] | null) ?? []} />
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-500/10 text-gray-400'}`}>
                      {(status === 'deploying' || status === 'rollback_requested') && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      {STATUS_LABELS[status] ?? status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {new Date(u.foundAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {status === 'pending' && (
                        <>
                          <button title="Approve" onClick={() => approve.mutate({ id: u.id })} className="text-green-400 hover:text-green-300">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button title="Ignore" onClick={() => ignore.mutate({ id: u.id })} className="text-muted-foreground hover:text-foreground">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {status === 'approved' && (
                        <button title="Deploy now" onClick={() => deploy.mutate({ id: u.id })} className="text-blue-400 hover:text-blue-300">
                          <PlayCircle className="w-4 h-4" />
                        </button>
                      )}
                      {status === 'ignored' && (
                        <button title="Restore to pending" onClick={() => unignore.mutate({ id: u.id })} className="text-muted-foreground hover:text-foreground">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {status === 'deployed' && (
                        <button title="Rollback" onClick={() => rollback.mutate({ id: u.id })} className="text-muted-foreground hover:text-orange-400">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
