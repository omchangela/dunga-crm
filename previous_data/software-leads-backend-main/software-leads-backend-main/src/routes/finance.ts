import { Router } from 'express'
import {
    getFinanceSummary,
    getProjectLedger,
    collectPayment,
    updateTransaction,
    deleteTransaction,
    getFinanceProjects
} from '../controllers/finance'

const router = Router()

router.get('/summary',                  getFinanceSummary)
router.get('/projects',                 getFinanceProjects)
router.get('/project/:projectId',       getProjectLedger)
router.post('/collect',                 collectPayment)
router.patch('/:transactionId',         updateTransaction)
router.delete('/:transactionId',        deleteTransaction)

export default router