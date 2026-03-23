import { useState } from 'react'
import { trpc } from '../lib/trpc'
import { Server, Plus, Trash2, Clock, Pencil, Check, X } from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: 'bg-green-500/10 text-green-400',
    offline: 'bg-red-500/10 text-red-400',
    unknown: 'bg-gray-500/10 text-gray-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? colors['unknown']}`}>
      {status}
    </span>
  )
}

function RegisterDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'vm' | 'k8s'>('vm')
  const [result, setResult] = useState<{ agentId: string; apiKey: string } | null>(null)

  const register = trpc.agents.register.useMutation({
    onSuccess: (data) => setResult(data),
  })

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4">
          <h2 className="font-semibold">Agent Registered</h2>
          <p className="text-sm text-muted-foreground">
            Copy the API key now — it will not be shown again.
          </p>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Agent ID</p>
            <code className="block text-xs bg-muted p-2 rounded">{result.agentId}</code>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">API Key</p>
            <code className="block text-xs bg-muted p-2 rounded break-all">{result.apiKey}</code>
          </div>
          <button
            className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="font-semibold">Register New Agent</h2>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Name</label>
          <input
            className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. prod-vm-01"
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Type</label>
          <select
            className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as 'vm' | 'k8s')}
          >
            <option value="vm">VM (Docker)</option>
            <option value="k8s">Kubernetes</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 bg-primary text-primary-foreground rounded-md py-2 text-sm disabled:opacity-50"
            disabled={!name || register.isPending}
            onClick={() => register.mutate({ name, type })}
          >
            {register.isPending ? 'Registering…' : 'Register'}
          </button>
          <button
            className="flex-1 bg-muted border border-border rounded-md py-2 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
        {register.error && (
          <p className="text-sm text-destructive">{register.error.message}</p>
        )}
      </div>
    </div>
  )
}

export default function HostsPage() {
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const { data: agents, refetch } = trpc.agents.list.useQuery()
  const deleteAgent = trpc.agents.delete.useMutation({ onSuccess: () => refetch() })
  const renameAgent = trpc.agents.rename.useMutation({ onSuccess: () => { refetch(); setEditingId(null) } })

  function startEdit(id: string, currentName: string) {
    setEditingId(id)
    setEditName(currentName)
  }

  function submitRename(id: string) {
    const trimmed = editName.trim()
    if (trimmed) renameAgent.mutate({ id, name: trimmed })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hosts</h1>
        <button
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
          onClick={() => setShowDialog(true)}
        >
          <Plus className="w-4 h-4" />
          Register Agent
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {agents?.length === 0 && (
          <p className="text-sm text-muted-foreground p-4">No agents registered yet.</p>
        )}
        {agents?.map((agent) => (
          <div key={agent.id} className="flex items-center gap-4 p-4">
            <Server className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              {editingId === agent.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    className="bg-muted border border-border rounded px-2 py-0.5 text-sm w-48"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(agent.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                  <button onClick={() => submitRename(agent.id)} disabled={renameAgent.isPending} className="text-green-400 hover:text-green-300 disabled:opacity-50">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <p className="font-medium text-sm">{agent.name}</p>
                  <button
                    onClick={() => startEdit(agent.id, agent.name)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground font-mono">{agent.id}</p>
            </div>
            <StatusBadge status={agent.status} />
            <span className="text-xs text-muted-foreground uppercase">{agent.type}</span>
            {agent.lastSeenAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(agent.lastSeenAt).toLocaleTimeString()}
              </span>
            )}
            <button
              className="text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => deleteAgent.mutate({ id: agent.id })}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {showDialog && (
        <RegisterDialog onClose={() => { setShowDialog(false); refetch() }} />
      )}
    </div>
  )
}
