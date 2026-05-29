import express from 'express';
import { searchClients, createClient, addPet, updatePet, deletePet, generatePetId } from '../controllers/clientController.js';
import { optionalAuth } from '../middleware/auth.js';
import { Client } from '../models.js';
import { createCrudHandlers } from '../utils/crudFactory.js';

const router = express.Router();

const preUpdateClient = async (req, res, next) => {
  try {
    if (req.body.pets && Array.isArray(req.body.pets)) {
      const client = await Client.findOne({ _id: req.params.id });
      if (client) {
        for (const pet of req.body.pets) {
          if (!pet.petId) {
            pet.petId = await generatePetId(client.clinic_id, pet.species);
          }
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

router.get('/search', optionalAuth, searchClients);
router.post('/:id/pets', optionalAuth, addPet);
router.put('/:id/pets/:petId', optionalAuth, updatePet);
router.delete('/:id/pets/:petId', optionalAuth, deletePet);

const { getAll, getOne, create, update, remove } = createCrudHandlers(Client, 'Client');
router.get('/', optionalAuth, getAll);
router.get('/:id', optionalAuth, getOne);
router.post('/', optionalAuth, createClient);
router.patch('/:id', optionalAuth, preUpdateClient, update);
router.delete('/:id', optionalAuth, remove);

export default router;
