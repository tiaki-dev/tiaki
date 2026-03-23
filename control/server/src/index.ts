import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from './db/index.js'
import { appRouter } from './routers/index.js'
import { createContext } from './trpc.js'
import { startScheduler } from './scheduler/index.js'
import { verifySchema } from './lib/verify-schema.js'

const app = express()
const PORT = parseInt(process.env['PORT'] ?? '3001', 10)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Middleware ───────────────────────────────────────────────────────────────

// H3: Security headers (CSP, X-Frame-Options, HSTS, etc.)
app.use(helmet({ contentSecurityPolicy: false }))

// H5: CORS — only needed in dev (in production client is served from the same origin)
if (process.env['NODE_ENV'] !== 'production') {
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173']
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        cb(new Error(`CORS: origin ${origin} not allowed`))
      },
      credentials: true,
    }),
  )
}

app.use(express.json({ limit: '5mb' }))

// H1: Rate limiting
// General limit for all /trpc routes (covers UI + agent calls)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})
// Strict limit for agent registration (prevents rogue-agent flooding)
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration requests.' },
})

app.use('/trpc', generalLimiter)
app.use('/trpc/agents.register', registrationLimiter)

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

// ─── tRPC ─────────────────────────────────────────────────────────────────────

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`[trpc] error on ${path}:`, error)
      }
    },
  }),
)

// ─── Static client (production) ───────────────────────────────────────────────

if (process.env['NODE_ENV'] === 'production') {
  const publicDir = path.join(__dirname, '..', '..', 'public')
  app.use(express.static(publicDir))
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'))
  })
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  if (!process.env['ADMIN_TOKEN']) {
    console.error('[server] ADMIN_TOKEN is not set — set it in your .env file')
    process.exit(1)
  }

  // Run migrations on startup
  try {
    await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname })
    console.log('[server] migrations applied')
    await verifySchema()
  } catch (err) {
    console.error('[server] migration failed', err)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`)
    startScheduler()
  })
}

start()

export type { AppRouter } from './routers/index.js'
