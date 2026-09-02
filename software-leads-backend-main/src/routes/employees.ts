import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { requireEmployee }           from '../middleware/employeeAuth'

import {
    createEmployee,
    getAllEmployees,
    getEmployee,
    updateEmployee,
    deleteEmployee,
    setTarget,
    getEmployeeStats,
    getEmployeeEnums,
    employeeLogin,
    employeeLogout,
    getEmployeeMe,
    getEmployeeLeads,
    getEmployeeLead,
    getEmployeeCustomers,
    getEmployeeCustomer,
    getEmployeeProjects,
    getEmployeeProject,
    getEmployeeDashboard,
    employeeChangePassword,
    assignLead,
    unassignLead,
    logFollowUp,
    getLeadFollowUps,
    createEmployeeLead,
    updateEmployeeLeadStatus,
    convertEmployeeLead,
    toggleEmployeeLeadFollowUp,
    createEmployeeLeadReminder,
    deleteEmployeeLead,
    getEmployeeEstimation,
    createEmployeeProject,
    updateEmployeeProjectStatus,
    updateEmployeeProject,
    generateEmployeeEstimationPdf,
    getEmployeeEstimationPdfStatus,
    downloadEmployeeEstimationPdf,
    generateEmployeeProjectPdf,
    getEmployeeProjectPdfStatus,
    downloadEmployeeProjectPdf,
    getEmployeeReminders,
    createEmployeeReReminder,
    markEmployeeReminderDone,
    deleteEmployeeReminder,
    getEmployeeSubscriptions,
    getEmployeeSubscription,
    createEmployeeSubscription,
    updateEmployeeSubscription,
    deleteEmployeeSubscription,
    payEmployeeSubscription,
    getEmployeeDevelopers,
        addEmployeeProjectFeature,
    removeEmployeeProjectFeature,
     assignEmployeeProjectDevelopers
} from '../controllers/employees'

// ─── ADMIN ROUTES (/api/employees) ──────────────────
export const employeeAdminRouter = Router()

employeeAdminRouter.get('/enums',        requireAuth, requireAdmin, getEmployeeEnums)
employeeAdminRouter.get('/',             requireAuth, requireAdmin, getAllEmployees)
employeeAdminRouter.post('/',            requireAuth, requireAdmin, createEmployee)
employeeAdminRouter.get('/:id',          requireAuth, requireAdmin, getEmployee)
employeeAdminRouter.put('/:id',          requireAuth, requireAdmin, updateEmployee)
employeeAdminRouter.delete('/:id',       requireAuth, requireAdmin, deleteEmployee)
employeeAdminRouter.post('/:id/target',  requireAuth, requireAdmin, setTarget)
employeeAdminRouter.get('/:id/stats',    requireAuth, requireAdmin, getEmployeeStats)

// ─── LEAD ACTIONS (mounted under /api/leads in app.ts) ──
export const leadEmployeeRouter = Router()

leadEmployeeRouter.post('/:id/assign',    requireAuth,     assignLead)
leadEmployeeRouter.delete('/:id/assign',  requireAuth,     unassignLead)
leadEmployeeRouter.post('/:id/follow-up', requireEmployee, logFollowUp)
leadEmployeeRouter.get('/:id/follow-ups', requireAuth,     getLeadFollowUps)

// ─── EMPLOYEE PORTAL (/api/employee) ────────────────
export const employeePortalRouter = Router()

// public
employeePortalRouter.post('/login',  employeeLogin)
employeePortalRouter.post('/logout', employeeLogout)

// me + dashboard
employeePortalRouter.get('/me',               requireEmployee, getEmployeeMe)
employeePortalRouter.get('/dashboard',        requireEmployee, getEmployeeDashboard)
employeePortalRouter.post('/change-password', requireEmployee, employeeChangePassword)

// ─── LEAD ROUTES ────────────────────────────────────
employeePortalRouter.get('/leads',                      requireEmployee, getEmployeeLeads)
employeePortalRouter.post('/leads',                     requireEmployee, createEmployeeLead)
employeePortalRouter.get('/leads/:id',                  requireEmployee, getEmployeeLead)
employeePortalRouter.patch('/leads/:id/status',         requireEmployee, updateEmployeeLeadStatus)
employeePortalRouter.post('/leads/:id/convert',         requireEmployee, convertEmployeeLead)
employeePortalRouter.patch('/leads/:id/toggle-follow-up', requireEmployee, toggleEmployeeLeadFollowUp)
employeePortalRouter.post('/leads/:id/reminders',       requireEmployee, createEmployeeLeadReminder)
employeePortalRouter.delete('/leads/:id',               requireEmployee, deleteEmployeeLead)

// ─── CUSTOMER ROUTES ────────────────────────────────
employeePortalRouter.get('/customers',     requireEmployee, getEmployeeCustomers)
employeePortalRouter.get('/customers/:id', requireEmployee, getEmployeeCustomer)

// ─── ESTIMATION ROUTES ──────────────────────────────
employeePortalRouter.get('/estimation', requireEmployee, getEmployeeEstimation)

// ─── PROJECT ROUTES ─────────────────────────────────
employeePortalRouter.get('/projects',              requireEmployee, getEmployeeProjects)
employeePortalRouter.post('/projects',             requireEmployee, createEmployeeProject)
employeePortalRouter.get('/projects/:id',          requireEmployee, getEmployeeProject)
employeePortalRouter.patch('/projects/:id',        requireEmployee, updateEmployeeProject)
employeePortalRouter.patch('/projects/:id/status', requireEmployee, updateEmployeeProjectStatus)

// estimation PDF
employeePortalRouter.post('/projects/:id/pdf',                     requireEmployee, generateEmployeeEstimationPdf)
employeePortalRouter.get('/projects/:id/pdf',                      requireEmployee, downloadEmployeeEstimationPdf)
employeePortalRouter.get('/projects/:id/pdf/status/:jobId',        requireEmployee, getEmployeeEstimationPdfStatus)

// project PDF
employeePortalRouter.post('/projects/:id/project-pdf',             requireEmployee, generateEmployeeProjectPdf)
employeePortalRouter.get('/projects/:id/project-pdf',              requireEmployee, downloadEmployeeProjectPdf)
employeePortalRouter.get('/projects/:id/project-pdf/status/:jobId',requireEmployee, getEmployeeProjectPdfStatus)

// ─── REMINDER ROUTES ────────────────────────────────
employeePortalRouter.get('/reminders',                requireEmployee, getEmployeeReminders)
employeePortalRouter.post('/reminders/:id/rereminder',requireEmployee, createEmployeeReReminder)
employeePortalRouter.patch('/reminders/:id/done',     requireEmployee, markEmployeeReminderDone)
employeePortalRouter.delete('/reminders/:id',         requireEmployee, deleteEmployeeReminder)

// ─── SUBSCRIPTION ROUTES ────────────────────────────
employeePortalRouter.get('/subscriptions',
    requireEmployee, getEmployeeSubscriptions)

employeePortalRouter.post('/subscriptions',
    requireEmployee, createEmployeeSubscription)

employeePortalRouter.get('/subscriptions/:id',
    requireEmployee, getEmployeeSubscription)

employeePortalRouter.put('/subscriptions/:id',
    requireEmployee, updateEmployeeSubscription)

employeePortalRouter.delete('/subscriptions/:id',
    requireEmployee, deleteEmployeeSubscription)

employeePortalRouter.post('/subscriptions/:id/pay',
    requireEmployee, payEmployeeSubscription)

employeePortalRouter.get('/developers', requireEmployee, getEmployeeDevelopers)

employeePortalRouter.post('/projects/:id/features',
    requireEmployee, addEmployeeProjectFeature)

employeePortalRouter.delete('/projects/:id/features/:featureId',
    requireEmployee, removeEmployeeProjectFeature)

employeePortalRouter.patch('/projects/:id/developers',
    requireEmployee, assignEmployeeProjectDevelopers)