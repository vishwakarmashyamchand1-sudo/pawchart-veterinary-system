import express from 'express';
import { getResource, createResource, updateResource, deleteResource } from '../controllers/crudController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/:resource', optionalAuth, getResource);
router.post('/:resource', optionalAuth, createResource);
router.patch('/:resource/:id', optionalAuth, updateResource);
router.delete('/:resource/:id', optionalAuth, deleteResource);

export default router;
