import { Router } from 'express'
import {
    developerLogin,
    developerLogout,
    getDeveloperMe,
    developerChangePassword,
    developerRefresh,
    getDeveloperDashboard,
    getDeveloperProjects,
    getDeveloperProject,
    getDeveloperTasks,
    getDeveloperTask,
    updateDeveloperTaskStatus
} from '../controllers/developerPortal'
import { requireDeveloper } from '../middleware/developerAuth'

// ← MUST BE HERE FIRST
const router = Router()

// ─── PUBLIC ──────────────────────────────────────
router.post('/login',   developerLogin)
router.post('/logout',  developerLogout)
router.post('/refresh', developerRefresh)

// ─── PROTECTED ───────────────────────────────────
router.get('/me',               requireDeveloper, getDeveloperMe)
router.post('/change-password', requireDeveloper, developerChangePassword)
router.get('/dashboard',        requireDeveloper, getDeveloperDashboard)

// projects
router.get('/projects',     requireDeveloper, getDeveloperProjects)
router.get('/projects/:id', requireDeveloper, getDeveloperProject)

// tasks
router.get('/tasks',              requireDeveloper, getDeveloperTasks)
router.get('/tasks/:id',          requireDeveloper, getDeveloperTask)
router.patch('/tasks/:id/status', requireDeveloper, updateDeveloperTaskStatus)

export default router