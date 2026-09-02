import { Router } from 'express'
import {
    getEnums,
    getSummary,
    getAllSubscriptions,
    getSubscription,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    paySubscription
} from '../controllers/subscriptions'

const router = Router()

router.get('/enums',     getEnums)
router.get('/summary',   getSummary)

router.get('/',          getAllSubscriptions)
router.post('/',         createSubscription)

router.get('/:id',       getSubscription)
router.put('/:id',       updateSubscription)
router.delete('/:id',    deleteSubscription)
router.post('/:id/pay',  paySubscription)

export default router