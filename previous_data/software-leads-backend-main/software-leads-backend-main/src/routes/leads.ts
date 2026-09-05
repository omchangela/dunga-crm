import { Router } from 'express'
import {
    createLead,
    getAllLeads,
    getLead,
    updateLead,
    deleteLead,
    updateStatus,
    toggleFollowUp,
    bulkFollowUp,
    bulkImport,
    getImportStatus
} from '../controllers/leads'
import {
    SERVICE_TYPES,
    LEAD_SOURCES,
    LEAD_STATUSES
} from '../lib/enums'
import { csvUpload } from '../middleware/upload'
import { convertLead } from '../controllers/customers'

import {
    assignLead,
    unassignLead,
    logFollowUp,
    getLeadFollowUps
} from '../controllers/employees'
import { requireEmployee } from '../middleware/employeeAuth'
import { requireAuth }  from '../middleware/auth'



const router = Router()

// static routes first
router.get('/enums', (req, res) => {
    res.json({
        success: true,
        data: {
            serviceTypes: SERVICE_TYPES,
            leadSources:  LEAD_SOURCES,
            leadStatuses: LEAD_STATUSES
        }
    })
})

router.post('/bulk-import',   csvUpload.single('file'), bulkImport)
router.patch('/follow-up',    bulkFollowUp)
router.get('/',               getAllLeads)
router.post('/',              createLead)

// dynamic routes last
router.get('/:id',            getLead)
router.put('/:id',            updateLead)
router.delete('/:id',         deleteLead)
router.patch('/:id/status',   updateStatus)
router.patch('/:id/follow-up', toggleFollowUp)


// POST /api/leads/:leadId/convert
router.post('/:leadId/convert', convertLead)

router.get('/import/status/:jobId', getImportStatus)
router.post('/bulk-import',         bulkImport)

router.post('/:id/assign',    requireAuth,     assignLead)
router.delete('/:id/assign',  requireAuth,     unassignLead)
router.post('/:id/follow-up', requireEmployee, logFollowUp)
router.get('/:id/follow-ups', requireAuth,     getLeadFollowUps)

router.post('/:id/follow-up', requireEmployee, logFollowUp)

export default router