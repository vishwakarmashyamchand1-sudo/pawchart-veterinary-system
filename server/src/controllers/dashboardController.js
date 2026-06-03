import { Appointment, Client, FollowUp, Vaccination, Vet } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const filter = getQueryFilter(req);
    
    const getLocalStr = (d = new Date()) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const todayStr = getLocalStr();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalStr(yesterday); 

    const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Appointments (Fast DB Counts)
    const [apptsToday, apptsYesterday, vetCount] = await Promise.all([
      Appointment.countDocuments({ ...filter, date: todayStr }),
      Appointment.countDocuments({ ...filter, date: yesterdayStr }),
      Vet.countDocuments(filter)
    ]);

    const apptsDiff = apptsToday - apptsYesterday;
    const apptsHint = apptsDiff >= 0 
      ? `+${apptsDiff} appointments compared to yesterday` 
      : `${apptsDiff} appointments compared to yesterday`;

    const upcomingAppointments = await Appointment.find({
      ...filter,
      status: { $nin: ['Completed', 'Cancelled'] },
      date: { $gte: todayStr }
    }).sort({ date: 1, time: 1 }).limit(30).lean();

    const todayApptsDb = await Appointment.find({ ...filter, date: todayStr }).select('petName').lean();
    const todayPetNames = new Set(todayApptsDb.map(a => a.petName?.trim().toLowerCase()).filter(Boolean));

    // 2. Active patients (DB Size Aggregation)
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

    // 3. Follow ups (Fast DB Counts)
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
      : `+ ${Math.abs(followDiff)} from yesterday`;

    // 4. Vaccines (EXTREME OPTIMIZATION: Process grouping entirely in MongoDB C++ Engine)
    const vaxAgg = await Vaccination.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { petName: { $toLower: "$petName" }, ownerName: { $toLower: "$ownerName" }, vaccine: { $toLower: "$vaccine" } },
          hasPending: {
            $max: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$status", "Pending"] },
                    {
                      $and: [
                        { $ne: ["$dueDate", null] },
                        { $ne: ["$dueDate", ""] },
                        { $lte: ["$dueDate", next30Days] }
                      ]
                    }
                  ]
                },
                1,
                0
              ]
            }
          },
          hasCompleted: { $max: { $cond: [{ $in: ["$status", ["Completed", "Waived"]] }, 1, { $cond: [{ $ne: ["$lastDate", null] }, 1, 0] }] } },
          dueDate: { $min: "$dueDate" },
          petName: { $first: "$petName" },
          ownerName: { $first: "$ownerName" },
          vaccine: { $first: "$vaccine" },
          docId: { $first: "$_id" },
          isRecorded: { $max: { $cond: [{ $eq: ["$isRecorded", true] }, 1, 0] } }
        }
      },
      { $match: { hasPending: 1 } }
    ]);

    let vaxDue = 0;
    let overdueCount = 0;
    let alerts = [];

    vaxAgg.forEach(v => {
      let currentStatus = 'Pending';
      if (!v.isRecorded) {
        currentStatus = 'Not recorded';
      } else if (!v.dueDate) {
        currentStatus = 'Not recorded';
      } else if (v.dueDate < todayStr) {
        currentStatus = 'Overdue';
      } else if (v.dueDate <= next30Days) {
        currentStatus = 'Due soon';
      } else {
        currentStatus = v.hasCompleted ? 'Up to date' : 'Upcoming';
      }

      if (currentStatus !== 'Up to date' && currentStatus !== 'Not recorded' && currentStatus !== 'Upcoming') {
        vaxDue++;
      }
      if (currentStatus === 'Overdue') {
        overdueCount++;
      }

      if (v.petName && todayPetNames.has(v.petName.trim().toLowerCase())) {
         if (currentStatus !== 'Up to date' && currentStatus !== 'Not recorded') {
            alerts.push({
               _id: v.docId,
               petName: v.petName,
               ownerName: v.ownerName,
               vaccine: v.vaccine,
               status: currentStatus,
               dueDate: v.dueDate
            });
         }
      }
    });

    const vaxHint = `${overdueCount} overdue`;

    // 5. Monitoring
    let monitoring = [];
    if (todayPetNames.size > 0) {
      const rawMonitoring = await FollowUp.find({
        ...filter,
        status: { $nin: ['Completed', 'Scheduled', 'Cancelled'] }
      }).lean();
      
      monitoring = rawMonitoring.filter(f => f.petName && todayPetNames.has(f.petName.trim().toLowerCase()));
      
      monitoring.forEach(f => {
        if (f.status !== 'Completed' && f.status !== 'Scheduled' && f.status !== 'Cancelled' && f.planDate) {
          if (f.planDate < todayStr) f.status = 'Overdue';
          else f.status = 'Pending';
        }
      });
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
