import { isSameDay } from '../utils/dateUtils.js';

/**
 * Service helpers for managing doctor consultation queue logic.
 */

export function getTodayAppointments(appointments = [], selectedDate, doctorName) {
  if (!appointments || appointments.length === 0) return [];
  
  return appointments.filter(appt => {
    // 1. Scope to correct doctor
    const matchesDoctor = !doctorName || appt.vetName === doctorName;
    // 2. Scope to the selected date (today)
    const matchesDate = isSameDay(appt.date, selectedDate);
    
    return matchesDoctor && matchesDate;
  }).sort((a, b) => {
    // Sort chronologically by time string (e.g. "09:00" < "10:30")
    return a.time.localeCompare(b.time);
  });
}

export function getNowInRoom(todayAppts = []) {
  return todayAppts.find(a => a.status === 'Now') || null;
}

export function getUpNext(todayAppts = []) {
  return todayAppts.filter(a => a.status === 'Scheduled');
}

export function getRemainingCount(todayAppts = []) {
  return todayAppts.filter(a => a.status === 'Scheduled').length;
}
