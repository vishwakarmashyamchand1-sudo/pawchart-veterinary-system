import { Appointment } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';

export const getAppointmentsByVet = async (req, res, next) => {
  try {
    const { vetName } = req.params;
    const filter = getQueryFilter(req);
    filter.vetName = vetName;
    
    const appointments = await Appointment.find(filter).sort({ date: 1, time: 1 }).lean();
    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

export const getAppointmentsByClient = async (req, res, next) => {
  try {
    const { clientName } = req.params;
    const filter = getQueryFilter(req);
    filter.ownerName = clientName;
    
    const appointments = await Appointment.find(filter).sort({ date: -1, time: -1 }).lean();
    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const appointment = await Appointment.findByIdAndUpdate(id, { status }, { new: true });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};
