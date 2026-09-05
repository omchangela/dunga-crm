import { Router } from 'express'
import {
    createProject,
    getCustomerProjects,
    getAllProjects,
    getProject,
    updateProject,
    deleteProject,
    setDeadline,
    assignDevelopers,
    addFeature,
    removeFeature,
    generatePdf,
    downloadPdf,
    generateProjectPdfController,
    downloadProjectPdf,
    getPdfJobStatus,
    getPaymentReceiptPdf
} from '../controllers/projects'

const router = Router({ mergeParams: true })

// nested customer routes
router.post('/',  createProject)
router.get('/',   getCustomerProjects)

// direct project routes
router.get('/all',                  getAllProjects)
router.get('/:id',                  getProject)
router.patch('/:id',                updateProject)
router.delete('/:id',               deleteProject)
router.patch('/:id/deadline',       setDeadline)
router.patch('/:id/developers',     assignDevelopers)
router.post('/:id/features',        addFeature)
router.delete('/:id/features/:featureId', removeFeature)
router.post('/:id/pdf',       generatePdf)
router.get('/:id/pdf',        downloadPdf)
router.post('/:id/project-pdf',  generateProjectPdfController)
router.get('/:id/project-pdf',   downloadProjectPdf)
router.get('/:id/receipt-pdf',   getPaymentReceiptPdf)
router.get('/:id/pdf/status/:jobId',          getPdfJobStatus)
router.get('/:id/project-pdf/status/:jobId',  getPdfJobStatus)

export default router