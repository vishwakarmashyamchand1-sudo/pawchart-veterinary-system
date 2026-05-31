import { Appointment, Client, FollowUp, Vaccination, Vet } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const filter = getQueryFilter(req);
    
    // Compute dynamic today's & yesterday's date strings
    const todayStr = new Date().toISOString().split('T')[0]; // '2026-05-23'
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // '2026-05-22'

    // Compute dynamic status for Vaccinations & FollowUps based on current date
    const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 1. Appointments counts & list
    const [apptsToday, apptsYesterday, upcomingAppointments, vetCount] = await Promise.all([
      Appointment.countDocuments({ ...filter, date: todayStr }),
      Appointment.countDocuments({ ...filter, date: yesterdayStr }),
      Appointment.find({ ...filter }).sort({ date: 1, time: 1 }).limit(5).lean(),
      Vet.countDocuments(filter)
    ]);
    const apptsDiff = apptsToday - apptsYesterday;
    const apptsHint = apptsDiff >= 0 
      ? `+${apptsDiff} appointments compared to yesterday` 
      : `${apptsDiff} appointments compared to yesterday`;

    // We need today's appointments for alerts and monitoring filters
    const todayAppointments = await Appointment.find({ ...filter, date: todayStr }).select('petName').lean();
    const todayPetNames = new Set(todayAppointments.map(a => a.petName?.toLowerCase()).filter(Boolean));

    // Active patients comparison (new this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const [totalPetsAgg, newThisMonthAgg] = await Promise.all([
      Client.aggregate([
        { $match: filter },
        { $project: { petCount: { $size: { $ifNull: ["$pets", []] } } } },
        { $group: { _id: null, total: { $sum: "$petCount" } } }
      ]),
      Client.aggregate([
        { $match: { ...filter, createdAt: { $gte: startOfMonth } } },
        { $project: { petCount: { $size: { $ifNull: ["$pets", []] } } } },
        { $group: { _id: null, total: { $sum: "$petCount" } } }
      ])
    ]);
    
    const activePatients = totalPetsAgg.length > 0 ? totalPetsAgg[0].total : 0;
    const newThisMonth = newThisMonthAgg.length > 0 ? newThisMonthAgg[0].total : 0;
    const patientsHint = `↑ ${newThisMonth} new this month`;

    // Vaccines comparison (overdue vaccines)
    const vaxBaseQuery = { 
      ...filter, 
      status: { $nin: ['Completed', 'Waived'] },
      dueDate: { $ne: null }
    };
    
    const [vaxDue, overdueCount] = await Promise.all([
      Vaccination.countDocuments({ ...vaxBaseQuery, dueDate: { $lte: next30Days } }),
      Vaccination.countDocuments({ ...vaxBaseQuery, dueDate: { $lt: todayStr } })
    ]);
    const vaxHint = `⚠ ${overdueCount} overdue`;

    // Follow ups pending comparison
    const followBaseQuery = {
      ...filter,
      status: { $nin: ['Completed', 'Scheduled', 'Cancelled'] },
      planDate: { $ne: null }
    };
    
    const [followPending, followPendingToday, followPendingYesterday] = await Promise.all([
      FollowUp.countDocuments({ ...followBaseQuery, planDate: { $gte: todayStr } }),
      FollowUp.countDocuments({ ...followBaseQuery, planDate: todayStr }),
      FollowUp.countDocuments({ ...followBaseQuery, planDate: { $gte: todayStr, $lte: yesterdayStr } }) // 0
    ]);
    
    const followDiff = followPendingToday - followPendingYesterday;
    const followHint = followDiff >= 0 
      ? `↑ ${followDiff} from yesterday` 
      : `↓ ${Math.abs(followDiff)} from yesterday`;

    // Alerts & Monitoring
    let alerts = [];
    let monitoring = [];
    
    if (todayPetNames.size > 0) {
      const petNamesRegex = Array.from(todayPetNames).map(name => new RegExp(`^${name}$`, 'i'));
      
      const [rawAlerts, rawMonitoring] = await Promise.all([
        Vaccination.find({ ...filter, petName: { $in: petNamesRegex } }).lean(),
        FollowUp.find({ ...filter, monitoring: true, petName: { $in: petNamesRegex } }).lean()
      ]);
      
      rawAlerts.forEach(v => {
        if (v.status !== 'Completed' && v.status !== 'Waived' && v.dueDate) {
          if (v.dueDate < todayStr) v.status = 'Overdue';
          else if (v.dueDate <= next30Days) v.status = 'Due soon';
          else v.status = 'Up to date';
        }
      });
      alerts = rawAlerts.filter(item => item.status !== 'Up to date' && item.status !== 'Completed' && item.status !== 'Waived');
      
      rawMonitoring.forEach(f => {
        if (f.status !== 'Completed' && f.status !== 'Scheduled' && f.status !== 'Cancelled' && f.planDate) {
          if (f.planDate < todayStr) f.status = 'Overdue';
          else f.status = 'Pending';
        }
      });
      monitoring = rawMonitoring;
    }

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
        veterinarianCount: vetCount
      },
      appointments: upcomingAppointments,
      alerts,
      monitoring
    });
  } catch (error) {
    next(error);
  }
};
