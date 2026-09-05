import { Router } from 'express'
import {
    getAllCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer
} from '../controllers/customers'

const router = Router()

router.get('/',       getAllCustomers)
router.get('/:id',    getCustomer)
router.patch('/:id',  updateCustomer)
router.delete('/:id', deleteCustomer)

export default router