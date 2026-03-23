import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../server/src/routers/index.js'

export const trpc = createTRPCReact<AppRouter>()

const TOKEN_KEY = 'tiaki-admin-token'

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/trpc',
      headers: () => {
        const token = auth.getToken()
        return token ? { Authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
})
