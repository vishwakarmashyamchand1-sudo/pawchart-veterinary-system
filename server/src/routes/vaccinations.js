import express from 'express';
import { getDueVaccinations, triggerManualReminder } from '../controllers/vaccinationController.js';
import { optionalAuth } from '../middleware/auth.js';
import { Vaccination } from '../models.js';
import { createCrudHandlers } from '../utils/crudFactory.js';

const router = express.Router();

router.get('/due', optionalAuth, getDueVaccinations);
router.post('/:id/remind', optionalAuth, triggerManualReminder);

const { getAll, getOne, create, update, remove } = createCrudHandlers(Vaccination, 'Vaccination');
router.get('/', optionalAuth, getAll);
router.get('/:id', optionalAuth, getOne);
router.post('/', optionalAuth, create);
router.patch('/:id', optionalAuth, update);
router.delete('/:id', optionalAuth, remove);

export default router;
