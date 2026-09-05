import { Router } from 'express'
import {
    getAllDevelopers,
    getDeveloper,
    createDeveloper,
    updateDeveloper,
    deleteDeveloper,
    getDeveloperEnums
} from '../controllers/developers'

const router = Router()

router.get('/enums',  getDeveloperEnums)
router.get('/',       getAllDevelopers)
router.post('/',      createDeveloper)
router.get('/:id',    getDeveloper)
router.put('/:id',    updateDeveloper)
router.delete('/:id', deleteDeveloper)

export default router