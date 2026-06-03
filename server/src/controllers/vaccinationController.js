import { Vaccination } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';
import { scheduleReminder } from '../services/reminderService.js';
import { calculateDueDate } from '../utils/dateCalculator.js';

export const getDueVaccinations = async (req, res, next) => {
  try {
    const filter = getQueryFilter(req);
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find all vaccinations that are due on or before today and not 'Up to date'
    filter.dueDate = { $lte: todayStr };
    filter.status = { $ne: 'Up to date' };
    
    const dueVaccines = await Vaccination.find(filter).sort({ dueDate: 1 }).lean();
    res.json(dueVaccines);
  } catch (error) {
    next(error);
  }
};

export const triggerManualReminder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vaccination = await Vaccination.findById(id);
    if (!vaccination) return res.status(404).json({ message: 'Vaccination record not found' });
    
    const details = `Vaccination for ${vaccination.vaccine} was due on ${vaccination.dueDate}. Please schedule an appointment.`;
    
    // Use the reminderService to queue a reminder immediately (delayMs = 0)
    await scheduleReminder(
      'vaccination',
      vaccination.petName,
      vaccination.ownerName,
      details,
      vaccination._id,
      0
    );
    
    // Temporarily update status in memory to respond quickly
    vaccination.reminderStatus = 'Triggered manually';
    await vaccination.save();
    
    res.json(vaccination);
  } catch (error) {
    next(error);
  }
};

export const triggerBatchReminders = async (req, res, next) => {
  try {
    const filter = getQueryFilter(req);
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find due/overdue
    filter.dueDate = { $lte: todayStr };
    filter.status = { $nin: ['Up to date', 'Completed'] };
    
    const dueVaccines = await Vaccination.find(filter);
    
    let sentCount = 0;
    for (const v of dueVaccines) {
      if (v.reminderStatus === 'Auto-sent just now' || v.reminderStatus === 'Sent just now') continue;
      
      const details = `Vaccination for ${v.vaccine} was due on ${v.dueDate}. Please schedule an appointment.`;
      
      await scheduleReminder(
        'vaccination',
        v.petName,
        v.ownerName,
        details,
        v._id,
        0
      );
      
      v.reminderStatus = 'Auto-sent just now';
      await v.save();
      sentCount++;
    }
    
    res.json({ message: `Successfully queued ${sentCount} reminders.`, count: sentCount });
  } catch (error) {
    next(error);
  }
};

export const updateVaccination = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const filter = { _id: id, ...getQueryFilter(req) };
    
    const existing = await Vaccination.findOne(filter);
    if (!existing) return res.status(404).json({ message: 'Vaccination not found' });
    
    // If it's being marked Completed right now
    if (updateData.status === 'Completed' && existing.status !== 'Completed') {
      Object.assign(existing, updateData);
      existing.lastDate = updateData.lastDate || new Date().toISOString().split('T')[0];
      
      // Update due date in-place for the next cycle: always 3 months from lastDate (or use client dueDate if sent)
      const nextDueDate = updateData.dueDate || calculateDueDate(existing.lastDate, '3 months');
      if (nextDueDate) {
        existing.dueDate = nextDueDate;
      }
    } else {
      Object.assign(existing, updateData);
    }
    existing.isRecorded = true;
    
    await existing.save();
    res.json(existing);
  } catch (error) {
    next(error);
  }
};
