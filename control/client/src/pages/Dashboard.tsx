import { Link } from 'react-router'
import { trpc } from '../lib/trpc'
import { Server, Box, RefreshCw, AlertCircle } from 'lucide-react'

function StatCard({ label, value, icon: Icon, color, href }: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  href?: string
}) {
  const inner = (
    <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-4">
      <div className={`p-2 rounded-md ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )
  return href ? <Link to={href} className="hover:opacity-80 transition-opacity">{inner}</Link> : inner
}

export default function DashboardPage() {
  const { data: agents } = trpc.agents.list.useQuery()
  const { data: containers } = trpc.containers.list.useQuery()
  const { data: pendingUpdates } = trpc.updates.list.useQuery({ status: 'pending' })

  const online = agents?.filter((a) => a.status === 'online').length ?? 0
  const offline = (agents?.length ?? 0) - online

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Agents"
          value={agents?.length ?? '—'}
          icon={Server}
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          label="Online / Offline"
          value={`${online} / ${offline}`}
          icon={Server}
          color="bg-green-500/10 text-green-400"
        />
        <StatCard
          label="Containers"
          value={containers?.length ?? '—'}
          icon={Box}
          color="bg-purple-500/10 text-purple-400"
        />
        <StatCard
          label="Pending Updates"
          value={pendingUpdates?.length ?? '—'}
          icon={RefreshCw}
          color="bg-yellow-500/10 text-yellow-400"
          href="/updates"
        />
      </div>

      {(pendingUpdates?.length ?? 0) > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-3">
            <AlertCircle className="w-4 h-4" />
            <span className="font-medium text-sm">{pendingUpdates!.length} update(s) pending review</span>
          </div>
          <div className="space-y-1">
            {pendingUpdates!.slice(0, 5).map((u) => (
              <Link key={u.id} to="/updates" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
                Container <span className="text-foreground font-mono text-xs">{u.containerId.slice(0, 12)}</span>{' '}
                {u.currentTag} → <span className="text-green-400">{u.latestTag}</span>
              </Link>
            ))}
            {pendingUpdates!.length > 5 && (
              <Link to="/updates" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                …and {pendingUpdates!.length - 5} more
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
