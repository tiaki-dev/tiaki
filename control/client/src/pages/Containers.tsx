import { useState } from 'react'
import { trpc } from '../lib/trpc'
import { Clock } from 'lucide-react'
import { HostFilter } from '../components/HostFilter'

export default function ContainersPage() {
  const [agentId, setAgentId] = useState<string | undefined>()
  const { data: containers } = trpc.containers.list.useQuery({ agentId })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Containers</h1>
        <HostFilter value={agentId} onChange={setAgentId} />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left p-3">Host</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Image</th>
              <th className="text-left p-3">Tag</th>
              <th className="text-left p-3">Compose Service</th>
              <th className="text-left p-3">Last Scanned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {containers?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No containers found. Register and start an agent to begin scanning.
                </td>
              </tr>
            )}
            {containers?.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="p-3 text-xs text-muted-foreground">{c.agentName}</td>
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{c.image}</td>
                <td className="p-3 font-mono text-xs">{c.currentTag}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {c.composeService ?? '—'}
                </td>
                <td className="p-3 text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(c.lastScannedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
