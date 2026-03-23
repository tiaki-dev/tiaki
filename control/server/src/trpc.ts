import { createHash, timingSafeEqual } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import type { Request, Response } from 'express'
import { db } from './db/index.js'
import { findAgentByKeyPrefix, updateAgentLastSeen } from './db/queries/agents.js'
import { verifyApiKey, extractKeyPrefix } from './lib/api-key.js'

/** Compare two strings in constant time by hashing both to equal-length digests first. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// ─── Context ─────────────────────────────────────────────────────────────────

export interface Context {
  req: Request
  res: Response
  db: typeof db
  /** Populated when request is authenticated as an agent */
  agentId?: string
}

export async function createContext({ req, res }: { req: Request; res: Response }): Promise<Context> {
  return { req, res, db }
}

// ─── tRPC init ───────────────────────────────────────────────────────────────

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

// ─── Admin auth ──────────────────────────────────────────────────────────────

const ADMIN_TOKEN = process.env['ADMIN_TOKEN']

/** Middleware: verifies Bearer admin token from ADMIN_TOKEN env var */
const adminAuthMiddleware = t.middleware(({ ctx, next }) => {
  const authHeader = ctx.req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing admin token' })
  }
  const token = authHeader.slice(7)
  if (!ADMIN_TOKEN || !safeEqual(token, ADMIN_TOKEN)) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid admin token' })
  }
  return next()
})

/** Use for all browser UI endpoints */
export const adminProcedure = t.procedure.use(adminAuthMiddleware)

// ─── Agent auth ──────────────────────────────────────────────────────────────

/** Middleware: verifies Bearer API key, attaches agentId to context */
const agentAuthMiddleware = t.middleware(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing Bearer token' })
  }

  const apiKey = authHeader.slice(7)
  const prefix = extractKeyPrefix(apiKey)
  const agent = await findAgentByKeyPrefix(prefix)

  if (!agent || !(await verifyApiKey(apiKey, agent.apiKeyHash))) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid API key' })
  }

  await updateAgentLastSeen(agent.id)
  return next({ ctx: { ...ctx, agentId: agent.id } })
})

/** Use for endpoints that agents call */
export const agentProcedure = t.procedure.use(agentAuthMiddleware)
