import express from 'express';
import { searchClients, createClient, addPet, updatePet, deletePet } from '../controllers/clientController.js';
import { optionalAuth } from '../middleware/auth.js';
import { Client } from '../models.js';
import { createCrudHandlers } from '../utils/crudFactory.js';

const router = express.Router();

router.get('/search', optionalAuth, searchClients);
router.post('/:id/pets', optionalAuth, addPet);
router.put('/:id/pets/:petId', optionalAuth, updatePet);
router.delete('/:id/pets/:petId', optionalAuth, deletePet);

const { getAll, getOne, create, update, remove } = createCrudHandlers(Client, 'Client');
router.get('/', optionalAuth, getAll);
router.get('/:id', optionalAuth, getOne);
router.post('/', optionalAuth, createClient);
router.patch('/:id', optionalAuth, update);
router.delete('/:id', optionalAuth, remove);

export default router;
