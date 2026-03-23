import { useState } from 'react'
import { trpc } from '../lib/trpc'
import { Plus, Trash2, ToggleLeft, ToggleRight, Pencil } from 'lucide-react'

type MaxBump = 'patch' | 'minor' | 'major' | null

const MAX_BUMP_LABELS: Record<string, string> = {
  '': 'Any version',
  patch: 'Patch only (x.y.Z)',
  minor: 'Minor & below (x.Y.z)',
  major: 'Major & below (X.y.z)',
}

const emptyForm = { name: '', agentId: '', imagePattern: '', autoApprove: false, maxBump: '' as string, priority: 0 }

export default function PoliciesPage() {
  const { data: policies, refetch } = trpc.policies.list.useQuery()
  const { data: agents, isLoading: agentsLoading } = trpc.agents.list.useQuery()
  const create = trpc.policies.create.useMutation({ onSuccess: () => { refetch(); setForm(emptyForm); setOpen(false) } })
  const update = trpc.policies.update.useMutation({ onSuccess: () => refetch() })
  const del = trpc.policies.delete.useMutation({ onSuccess: () => refetch() })

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(p: typeof policies extends (infer T)[] | undefined ? T : never) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      agentId: p.agentId ?? '',
      imagePattern: p.imagePattern,
      autoApprove: p.autoApprove,
      maxBump: p.maxBump ?? '',
      priority: p.priority,
    })
    setOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fields = {
      name: form.name,
      agentId: form.agentId || undefined,
      imagePattern: form.imagePattern,
      autoApprove: form.autoApprove,
      maxBump: (form.maxBump || null) as MaxBump,
      priority: form.priority,
    }
    if (editingId) {
      update.mutate({ id: editingId, ...fields }, { onSuccess: () => { refetch(); setOpen(false) } })
    } else {
      create.mutate(fields)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Policies</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm"
        >
          <Plus className="w-4 h-4" /> New Policy
        </button>
      </div>

      {/* Policy list */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Host</th>
              <th className="text-left p-3">Pattern</th>
              <th className="text-left p-3">Auto-approve</th>
              <th className="text-left p-3">Max bump</th>
              <th className="text-left p-3">Priority</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {policies?.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No policies yet.</td></tr>
            )}
            {policies?.map((p) => (
              <tr key={p.id} className={`hover:bg-muted/30 ${!p.enabled ? 'opacity-50' : ''}`}>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-xs">
                  {p.agentName
                    ? <span>{p.agentName}</span>
                    : <span className="text-muted-foreground italic">Global</span>}
                </td>
                <td className="p-3 font-mono text-xs">{p.imagePattern}</td>
                <td className="p-3">
                  {p.autoApprove
                    ? <span className="text-green-400 text-xs">Yes</span>
                    : <span className="text-muted-foreground text-xs">No</span>}
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {MAX_BUMP_LABELS[p.maxBump ?? ''] ?? p.maxBump}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{p.priority}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button
                      title={p.enabled ? 'Disable' : 'Enable'}
                      onClick={() => update.mutate({ id: p.id, enabled: !p.enabled })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {p.enabled ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      title="Edit"
                      onClick={() => openEdit(p)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => del.mutate({ id: p.id })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-lg p-6 space-y-4 w-full max-w-md"
          >
            <h2 className="font-semibold">{editingId ? 'Edit Policy' : 'New Policy'}</h2>

            <div className="space-y-1">
              <label htmlFor="policy-name" className="text-xs text-muted-foreground">Name</label>
              <input
                id="policy-name"
                required
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="policy-host" className="text-xs text-muted-foreground">Host (leave empty for global)</label>
              <select
                id="policy-host"
                disabled={agentsLoading}
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm disabled:opacity-50"
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              >
                <option value="">Global (all hosts)</option>
                {agents?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Image pattern (glob)</label>
              <input
                required
                placeholder="nginx:* or */myapp:*"
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm font-mono"
                value={form.imagePattern}
                onChange={(e) => setForm({ ...form, imagePattern: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoApprove}
                  onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })}
                />
                Auto-approve matching updates
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max version bump (when auto-approving)</label>
              <select
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
                value={form.maxBump}
                onChange={(e) => setForm({ ...form, maxBump: e.target.value })}
              >
                {Object.entries(MAX_BUMP_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Priority (lower = higher priority)</label>
              <input
                type="number"
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button type="submit" disabled={create.isPending || update.isPending} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50">
                {editingId ? (update.isPending ? 'Saving…' : 'Save') : (create.isPending ? 'Creating…' : 'Create')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
