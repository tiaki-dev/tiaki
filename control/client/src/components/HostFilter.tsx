import { trpc } from '../lib/trpc'

interface HostFilterProps {
  value: string | undefined
  onChange: (agentId: string | undefined) => void
}

export function HostFilter({ value, onChange }: HostFilterProps) {
  const { data: agents, isLoading } = trpc.agents.list.useQuery()

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      disabled={isLoading}
      className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
    >
      <option value="">All hosts</option>
      {agents?.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  )
}
