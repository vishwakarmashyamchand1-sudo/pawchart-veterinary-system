import { Appointment, Client, FollowUp, Vaccination, Vet } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const filter = getQueryFilter(req);
    const [appointments, clients, vaccinations, followUps, vets] = await Promise.all([
      Appointment.find(filter).sort({ date: 1, time: 1 }).lean(),
      Client.find(filter).lean(),
      Vaccination.find(filter).lean(),
      FollowUp.find(filter).lean(),
      Vet.find(filter).lean()
    ]);
    const activePatients = clients.reduce((total, client) => total + client.pets.length, 0);

    // Compute dynamic today's & yesterday's date strings
    const todayStr = new Date().toISOString().split('T')[0]; // '2026-05-23'
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // '2026-05-22'

    // Compute dynamic status for Vaccinations & FollowUps based on current date
    const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    vaccinations.forEach(v => {
      if (v.status !== 'Completed' && v.status !== 'Waived' && v.dueDate) {
        if (v.dueDate < todayStr) v.status = 'Overdue';
        else if (v.dueDate <= next30Days) v.status = 'Due soon';
        else v.status = 'Up to date';
      }
    });

    followUps.forEach(f => {
      if (f.status !== 'Completed' && f.status !== 'Scheduled' && f.status !== 'Cancelled' && f.planDate) {
        if (f.planDate < todayStr) f.status = 'Overdue';
        else f.status = 'Pending';
      }
    });

    // appointments comparison
    const todayAppointments = appointments.filter((item) => item.date === todayStr);
    const apptsToday = todayAppointments.length;
    const apptsYesterday = appointments.filter((item) => item.date === yesterdayStr).length;
    const apptsDiff = apptsToday - apptsYesterday;
    const apptsHint = apptsDiff >= 0 
      ? `+${apptsDiff} appointments compared to yesterday` 
      : `${apptsDiff} appointments compared to yesterday`;

    const todayPetNames = new Set(todayAppointments.map(a => a.petName?.toLowerCase()).filter(Boolean));

    // Active patients comparison
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const yesterdayStart = new Date(); yesterdayStart.setDate(yesterdayStart.getDate() - 1); yesterdayStart.setHours(0,0,0,0);
    const clientsToday = clients.filter(c => new Date(c.createdAt) >= todayStart);
    const clientsYesterday = clients.filter(c => new Date(c.createdAt) >= yesterdayStart && new Date(c.createdAt) < todayStart);
    const petsToday = clientsToday.reduce((sum, c) => sum + (c.pets || []).length, 0);
    const petsYesterday = clientsYesterday.reduce((sum, c) => sum + (c.pets || []).length, 0);
    const patientsDiff = petsToday - petsYesterday;
    const patientsHint = patientsDiff >= 0
      ? `+${patientsDiff} active patients compared to yesterday`
      : `${patientsDiff} active patients compared to yesterday`;

    // Vaccines comparison
    const vaxDue = vaccinations.filter((item) => item.status !== 'Up to date').length;
    const vaxDueToday = vaccinations.filter(v => v.dueDate <= todayStr && v.status !== 'Up to date').length;
    const vaxDueYesterday = vaccinations.filter(v => v.dueDate <= yesterdayStr && v.status !== 'Up to date').length;
    const vaxDiff = vaxDueToday - vaxDueYesterday;
    const vaxHint = vaxDiff >= 0 
      ? `+${vaxDiff} due compared to yesterday` 
      : `${vaxDiff} due compared to yesterday`;

    // Follow ups pending comparison
    const followPending = followUps.filter((item) => item.status === 'Pending').length;
    const followPendingToday = followUps.filter(f => f.planDate <= todayStr && f.status === 'Pending').length;
    const followPendingYesterday = followUps.filter(f => f.planDate <= yesterdayStr && f.status === 'Pending').length;
    const followDiff = followPendingToday - followPendingYesterday;
    const followHint = followDiff >= 0 
      ? `+${followDiff} more pending than yesterday` 
      : `${followDiff} fewer pending than yesterday`;

    res.json({
      stats: {
        appointmentsToday: apptsToday,
        appointmentsTodayHint: apptsHint,
        activePatients,
        activePatientsHint: patientsHint,
        vaccinesDue: vaxDue,
        vaccinesDueHint: vaxHint,
        followUpsPending: followPending,
        followUpsPendingHint: followHint,
        veterinarianCount: vets.length
      },
      appointments: appointments.slice(0, 5),
      alerts: vaccinations.filter((item) => item.status !== 'Up to date' && item.status !== 'Completed' && item.status !== 'Waived' && todayPetNames.has(item.petName?.toLowerCase())),
      monitoring: followUps.filter((item) => item.monitoring && todayPetNames.has(item.petName?.toLowerCase()))
    });
  } catch (error) {
    next(error);
  }
};
