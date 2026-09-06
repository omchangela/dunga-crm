import { Router } from 'express'
import {
    getFinanceSummary,
    getProjectLedger,
    collectPayment,
    updateTransaction,
    deleteTransaction,
    getFinanceProjects,
    generateReceipt,
    getPaymentReports
} from '../controllers/finance'

const router = Router()

router.get('/summary',                  getFinanceSummary)
router.get('/projects',                 getFinanceProjects)
router.get('/reports',                  getPaymentReports)
router.get('/project/:projectId',       getProjectLedger)
router.post('/collect',                 collectPayment)
router.get('/receipt/:transactionId',   generateReceipt)
router.patch('/:transactionId',         updateTransaction)
router.delete('/:transactionId',        deleteTransaction)

export default router