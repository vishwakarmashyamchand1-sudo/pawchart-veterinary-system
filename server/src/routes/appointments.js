import express from 'express';
import { getAppointmentsByVet, getAppointmentsByClient, updateAppointmentStatus, bookFollowUpRoute } from '../controllers/appointmentController.js';
import { optionalAuth } from '../middleware/auth.js';
import { Appointment } from '../models.js';
import { createCrudHandlers } from '../utils/crudFactory.js';

const router = express.Router();

// Client follow-up slot confirmation landing endpoint
router.get('/book-followup', bookFollowUpRoute);

router.get('/vet/:vetName', optionalAuth, getAppointmentsByVet);
router.get('/client/:clientName', optionalAuth, getAppointmentsByClient);
router.patch('/:id/status', optionalAuth, updateAppointmentStatus);

const { getAll, getOne, create, update, remove } = createCrudHandlers(Appointment, 'Appointment');
router.get('/', optionalAuth, getAll);
router.get('/:id', optionalAuth, getOne);
router.post('/', optionalAuth, create);
router.patch('/:id', optionalAuth, update);
router.delete('/:id', optionalAuth, remove);

export default router;
