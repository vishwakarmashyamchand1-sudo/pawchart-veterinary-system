import { Appointment, Client, FollowUp, Vaccination, Vet } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const filter = getQueryFilter(req);
    
    // Compute dynamic today's & yesterday's date strings
    const todayStr = new Date().toISOString().split('T')[0]; // e.g. '2026-05-23'
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // e.g. '2026-05-22'

    // Compute dynamic status for Vaccinations & FollowUps based on current date
    const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Fetch appointments using Count and limited Find for extreme performance
    const [apptsToday, apptsYesterday, vetCount] = await Promise.all([
      Appointment.countDocuments({ ...filter, date: todayStr }),
      Appointment.countDocuments({ ...filter, date: yesterdayStr }),
      Vet.countDocuments(filter)
    ]);

    const apptsDiff = apptsToday - apptsYesterday;
    const apptsHint = apptsDiff >= 0 
      ? `+${apptsDiff} appointments compared to yesterday` 
      : `${apptsDiff} appointments compared to yesterday`;

    // Only get the upcoming appointments for the dashboard list
    const upcomingAppointments = await Appointment.find({
      ...filter,
      status: { $nin: ['Completed', 'Cancelled'] },
      date: { $gte: todayStr }
    }).sort({ date: 1, time: 1 }).limit(30).lean();

    // We need today's appointments for alerts and monitoring filters
    const todayApptsDb = await Appointment.find({ ...filter, date: todayStr }).select('petName').lean();
    const todayPetNames = new Set(todayApptsDb.map(a => a.petName?.toLowerCase()).filter(Boolean));

    // 2. Active patients comparison
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
    const patientsHint = `+ ${newThisMonth} new this month`;

    // 3. Follow ups pending comparison
    const followBaseQuery = {
      ...filter,
      status: { $nin: ['Completed', 'Scheduled', 'Cancelled'] },
      planDate: { $ne: null }
    };
    
    const [followPending, followPendingToday, followPendingYesterday] = await Promise.all([
      FollowUp.countDocuments({ ...followBaseQuery, planDate: { $gte: todayStr } }),
      FollowUp.countDocuments({ ...followBaseQuery, planDate: todayStr }),
      FollowUp.countDocuments({ ...followBaseQuery, planDate: yesterdayStr })
    ]);
    
    const followDiff = followPendingToday - followPendingYesterday;
    const followHint = followDiff >= 0 
      ? `+ ${followDiff} from yesterday` 
      : `+ ${Math.abs(followDiff)} from yesterday`; // Kept the math.abs since original logic used it for visual minus handling in frontend

    // 4. Vaccines comparison (overdue vaccines) & Alerts 
    // Fetch ONLY the small projection to avoid pulling huge documents into memory
    const vaccinations = await Vaccination.find(filter)
      .select('petName ownerName vaccine status dueDate lastDate clientId')
      .lean();

    const petVaxMap = {};
    vaccinations.forEach(v => {
      const key = `${v.petName?.toLowerCase()}_${v.ownerName?.toLowerCase()}_${v.vaccine?.toLowerCase()}`;
      if (!petVaxMap[key]) petVaxMap[key] = [];
      petVaxMap[key].push(v);
    });

    let vaxDue = 0;
    let overdueCount = 0;
    let alerts = [];

    vaccinations.forEach(v => {
      const key = `${v.petName?.toLowerCase()}_${v.ownerName?.toLowerCase()}_${v.vaccine?.toLowerCase()}`;
      const petRecords = petVaxMap[key] || [];
      const hasRecorded = petRecords.some(r => r.status === 'Completed' || r.status === 'Waived' || r.lastDate);

      let currentStatus = v.status;
      if (!hasRecorded && currentStatus === 'Pending') {
        currentStatus = 'Not recorded';
      } else if (currentStatus !== 'Completed' && currentStatus !== 'Waived' && currentStatus !== 'Not recorded' && v.dueDate) {
        if (v.dueDate < todayStr) currentStatus = 'Overdue';
        else if (v.dueDate <= next30Days) currentStatus = 'Due soon';
        else currentStatus = 'Up to date';
      }

      // Calculate totals for dashboard
      if (currentStatus !== 'Up to date' && currentStatus !== 'Not recorded') {
        vaxDue++;
      }
      if (currentStatus === 'Overdue') {
        overdueCount++;
      }

      // Check if it should be an alert (pet has appointment today)
      if (todayPetNames.has(v.petName?.toLowerCase())) {
         if (currentStatus !== 'Up to date' && currentStatus !== 'Completed' && currentStatus !== 'Waived') {
            v.status = currentStatus; // assign dynamic status
            alerts.push(v);
         }
      }
    });

    const vaxHint = `${overdueCount} overdue`;

    // 5. Monitoring
    let monitoring = [];
    if (todayPetNames.size > 0) {
      const petNamesRegex = Array.from(todayPetNames).map(name => new RegExp(`^${name}$`, 'i'));
      const rawMonitoring = await FollowUp.find({ ...filter, monitoring: true, petName: { $in: petNamesRegex } }).lean();
      
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
