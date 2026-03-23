import { useState, useEffect } from 'react'
import { trpc } from '../lib/trpc'
import { CheckCircle, XCircle, PlayCircle, RotateCcw, AlertCircle, User, ChevronLeft, ChevronRight } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  approved: 'text-green-400',
  ignored: 'text-gray-400',
  deployed: 'text-blue-400',
  failed: 'text-red-400',
  rollback_requested: 'text-orange-400',
  rollback_completed: 'text-purple-400',
  rollback_failed: 'text-red-400',
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  approved: <CheckCircle className="w-3.5 h-3.5" />,
  ignored: <XCircle className="w-3.5 h-3.5" />,
  deployed: <PlayCircle className="w-3.5 h-3.5" />,
  failed: <AlertCircle className="w-3.5 h-3.5" />,
  rollback_requested: <RotateCcw className="w-3.5 h-3.5" />,
  rollback_completed: <RotateCcw className="w-3.5 h-3.5" />,
  rollback_failed: <AlertCircle className="w-3.5 h-3.5" />,
}

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleDetail(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const { data } = trpc.updates.listAuditLogPage.useQuery(
    { page, pageSize: PAGE_SIZE },
    { refetchInterval: 10_000 },
  )

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  useEffect(() => {
    if (data && page > data.totalPages) setPage(1)
  }, [data?.totalPages, page])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Audit Log</h1>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Actor</th>
              <th className="text-left p-3">Host</th>
              <th className="text-left p-3">Update</th>
              <th className="text-left p-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No audit log entries yet.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <>
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ACTION_COLORS[e.action] ?? 'text-foreground'}`}>
                      {ACTION_ICONS[e.action]}
                      {e.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <User className="w-3 h-3" />
                      {e.actor}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {e.agentName ?? '—'}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {e.updateResultId.slice(0, 8)}…
                  </td>
                  <td
                    className={`p-3 text-xs text-muted-foreground max-w-xs truncate ${e.detail ? 'cursor-pointer hover:text-foreground' : ''}`}
                    onClick={() => e.detail && toggleDetail(e.id)}
                    title={e.detail ? 'Click to expand' : undefined}
                  >
                    {e.detail ?? '—'}
                  </td>
                </tr>
                {expandedIds.has(e.id) && e.detail && (
                  <tr key={`${e.id}-detail`} className="bg-muted/20">
                    <td colSpan={6} className="px-3 pb-3 pt-0">
                      <pre className="text-xs text-foreground whitespace-pre-wrap break-words font-mono bg-muted/40 rounded p-3 max-h-64 overflow-y-auto">
                        {e.detail}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {rangeStart}–{rangeEnd} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span className="px-1">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
