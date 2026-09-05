import { Router } from 'express'
import {
    createReminder,
    getAllReminders,
    getLeadReminders,
    markAsDone,
    updateReminder,
    deleteReminder,
    createReReminder
} from '../controllers/reminders'

const router = Router({ mergeParams: true })

router.get('/',           getAllReminders)
router.post('/',          createReminder)
router.get('/lead',       getLeadReminders)
router.patch('/:id/done', markAsDone)
router.patch('/:id',      updateReminder)
router.delete('/:id',     deleteReminder)
router.post('/:id/rereminder', createReReminder)

export default router