import { useState } from 'react'
import { auth, trpcClient } from '../lib/trpc'

interface Props {
  onAuth: () => void
}

export default function LoginScreen({ onAuth }: Props) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return

    setLoading(true)
    setError(null)

    // Store token temporarily so the trpc client picks it up
    auth.setToken(token.trim())

    try {
      // Verify the token with a real API call
      await trpcClient.agents.list.query()
      onAuth()
    } catch {
      auth.clearToken()
      setError('Invalid token. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Tiaki</h1>
          <p className="mt-1 text-sm text-gray-400">Enter your admin token to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Admin token"
            autoFocus
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  )
}
