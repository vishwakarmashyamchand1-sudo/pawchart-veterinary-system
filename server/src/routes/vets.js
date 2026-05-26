import express from 'express';
import { searchVets, getVetAvailability } from '../controllers/vetController.js';
import { optionalAuth } from '../middleware/auth.js';
import { Vet } from '../models.js';
import { createCrudHandlers } from '../utils/crudFactory.js';

const router = express.Router();

router.get('/search', optionalAuth, searchVets);
router.get('/:id/availability', optionalAuth, getVetAvailability);

const { getAll, getOne, create, update, remove } = createCrudHandlers(Vet, 'Vet');
router.get('/', optionalAuth, getAll);
router.get('/:id', optionalAuth, getOne);
router.post('/', optionalAuth, create);
router.patch('/:id', optionalAuth, update);
router.delete('/:id', optionalAuth, remove);

export default router;
