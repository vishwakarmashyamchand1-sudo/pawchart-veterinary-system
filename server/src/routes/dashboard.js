import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuth, getDashboardStats);

export default router;
