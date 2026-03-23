import { router } from '../trpc.js'
import { agentsRouter } from './agents.js'
import { reportsRouter } from './reports.js'
import { containersRouter } from './containers.js'
import { updatesRouter } from './updates.js'
import { notificationsRouter } from './notifications.js'
import { settingsRouter } from './settings.js'
import { policiesRouter } from './policies.js'

export const appRouter = router({
  agents: agentsRouter,
  reports: reportsRouter,
  containers: containersRouter,
  updates: updatesRouter,
  notifications: notificationsRouter,
  settings: settingsRouter,
  policies: policiesRouter,
})

export type AppRouter = typeof appRouter
