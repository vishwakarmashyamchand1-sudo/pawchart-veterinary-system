import { Vet } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';

export const searchVets = async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = getQueryFilter(req);
    
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { specialization: { $regex: q, $options: 'i' } }
      ];
    }
    
    const vets = await Vet.find(filter).sort({ name: 1 }).lean();
    res.json(vets);
  } catch (error) {
    next(error);
  }
};

export const getVetAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vet = await Vet.findById(id).lean();
    if (!vet) return res.status(404).json({ message: 'Vet not found' });
    
    res.json({ status: vet.status, room: vet.room });
  } catch (error) {
    next(error);
  }
};
