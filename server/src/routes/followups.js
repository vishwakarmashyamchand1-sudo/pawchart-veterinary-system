import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { FollowUp } from '../models.js';
import { createCrudHandlers } from '../utils/crudFactory.js';

const router = express.Router();

const { getAll, getOne, create, update, remove } = createCrudHandlers(FollowUp, 'FollowUp');
router.get('/', optionalAuth, getAll);
router.get('/:id', optionalAuth, getOne);
router.post('/', optionalAuth, create);
router.patch('/:id', optionalAuth, update);
router.delete('/:id', optionalAuth, remove);

export default router;
