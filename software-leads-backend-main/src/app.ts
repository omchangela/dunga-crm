import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import 'express-async-errors'
import dotenv from 'dotenv'

dotenv.config()

// routes
import authRoutes         from './routes/auth'
import leadRoutes         from './routes/leads'
import reminderRoutes     from './routes/reminders'
import customerRoutes     from './routes/customers'
import projectRoutes      from './routes/projects'
import financeRoutes      from './routes/finance'
import developerRoutes    from './routes/developers'
import taskRoutes         from './routes/tasks'
import subscriptionRoutes from './routes/subscriptions'
import {
    employeeAdminRouter,
    employeePortalRouter,
    leadEmployeeRouter
} from './routes/employees'
import developerPortalRouter from './routes/developerPortal'

// middleware
import { errorHandler } from './middleware/errorHandler'
import { requireAuth }  from './middleware/auth'
// Start BullMQ workers inside this process
// Only on one cluster worker to avoid duplicates
import cluster from 'cluster'
import { startWorkers } from './startWorkers'

if (!cluster.isWorker || cluster.worker?.id === 1) {
    startWorkers()
}

const app = express()

// Trust Render / Vercel reverse proxy for HTTPS cookies
app.set('trust proxy', 1)

// CORS must be before Helmet
app.use(cors({
    origin: (origin, callback) => {
        // Reflect origin so credentials work from any Vercel domain or localhost
        callback(null, true)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie']
}))

app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Log all incoming HTTP requests to Render console
app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
        const duration = Date.now() - start
        console.log(`[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`)
    })
    next()
})

import { executeResetDb } from './controllers/resetDbController'

// health check (public)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        pid:    process.pid,
        uptime: process.uptime()
    })
})

// Public Database Reset Endpoint
app.all('/reset_db', async (req, res) => {
    try {
        const result = await executeResetDb()
        res.json(result)
    } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message ?? 'Reset failed.' })
    }
})

app.all('/api/reset_db', async (req, res) => {
    try {
        const result = await executeResetDb()
        res.json(result)
    } catch (err: any) {
        res.status(500).json({ success: false, error: err?.message ?? 'Reset failed.' })
    }
})

// ─── PUBLIC ROUTES ──────────────────────────────
app.use('/api/auth', authRoutes)

// ─── PROTECTED ROUTES ───────────────────────────
app.use('/api/leads',                            requireAuth, leadRoutes)
app.use('/api/leads/:leadId/reminders',          requireAuth, reminderRoutes)
app.use('/api/reminders',                        requireAuth, reminderRoutes)
app.use('/api/customers',                        requireAuth, customerRoutes)
app.use('/api/customers/:customerId/projects',   requireAuth, projectRoutes)
app.use('/api/projects',                         requireAuth, projectRoutes)
app.use('/api/finance',                          requireAuth, financeRoutes)
app.use('/api/developers',                       requireAuth, developerRoutes)
app.use('/api/tasks',                            requireAuth, taskRoutes)
app.use('/api/subscriptions',                    requireAuth, subscriptionRoutes)

// Employee admin management (admin only)
app.use('/api/employees',  requireAuth, employeeAdminRouter)

// Employee portal (employee login)
app.use('/api/employee',   employeePortalRouter)

// Lead employee actions (assign, follow-up)
app.use('/api/leads',      leadEmployeeRouter)

app.use('/api/developer', developerPortalRouter)



app.use(errorHandler)


export default app