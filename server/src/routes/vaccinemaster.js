import express from 'express';
import { VaccineMaster } from '../models.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const records = await VaccineMaster.find().sort({ createdAt: 1 });
    res.json({ data: records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const newRecord = new VaccineMaster(req.body);
    const saved = await newRecord.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
