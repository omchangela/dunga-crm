import { Router } from 'express'
import {
    login,
    refresh,
    logout,
    logoutAll,
    getMe,
    changePassword,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser
} from '../controllers/auth'
import { requireAuth, requireAdmin } from '../middleware/auth'

const router = Router()

// ─── PUBLIC ──────────────────────────────────────
router.post('/login',    login)
router.post('/refresh',  refresh)
router.post('/logout',   logout)

// ─── AUTHENTICATED ──────────────────────────────
router.get('/me',                requireAuth, getMe)
router.post('/logout-all',       requireAuth, logoutAll)
router.post('/change-password',  requireAuth, changePassword)

// ─── ADMIN ONLY ─────────────────────────────────
router.get('/users',         requireAuth, requireAdmin, getAllUsers)
router.post('/users',        requireAuth, requireAdmin, createUser)
router.put('/users/:id',     requireAuth, requireAdmin, updateUser)
router.delete('/users/:id',  requireAuth, requireAdmin, deleteUser)

export default router