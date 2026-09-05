import { Router } from 'express'
import {
    getAllTasks,
    getTask,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    getTaskEnums,
    getProjectDevelopers
} from '../controllers/tasks'

const router = Router()

router.get('/enums',                       getTaskEnums)
router.get('/project/:projectId/developers', getProjectDevelopers)
router.get('/',                            getAllTasks)
router.post('/',                           createTask)
router.get('/:id',                         getTask)
router.put('/:id',                         updateTask)
router.patch('/:id/status',                updateTaskStatus)
router.delete('/:id',                      deleteTask)

export default router