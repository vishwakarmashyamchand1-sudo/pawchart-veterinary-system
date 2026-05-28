import { Appointment, Client, Vet, FollowUp, Vaccination } from '../models.js';
import Clinic from '../models/Clinic.js';
import { 
  sendAppointmentReminderMail, 
  sendMissedAppointmentAlertMail, 
  sendPendingFollowUpReminderMail,
  sendVaccinationReminderMail
} from './mailService.js';

let Queue = null;
let reminderQueue = null;
let isRedisOnline = false;
let _redisErrorLogged = false;

/**
 * Timezone-resilient Date calculation helper
 */
function getLocalDateStringOffset(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Safely initialize the reminder scheduler
 */
export async function initReminderScheduler() {
  try {
    // Attempt dynamic import of bull
    const bullModule = await import('bull');
    Queue = bullModule.default || bullModule;
    
    // Attempt to instantiate the queue on local Redis
    reminderQueue = new Queue('veterinary-reminders', process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
      redis: {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
      }
    });

    // Check for redis connection error (log once to avoid noisy repeated warnings)
    reminderQueue.on('error', (err) => {
      if (!_redisErrorLogged) {
        console.warn("⚠️ Redis connection failed. Switched to offline in-memory reminder backup scheduler.", err.message || err);
        _redisErrorLogged = true;
      }
      isRedisOnline = false;
    });

    // Setup queue processor
    reminderQueue.process(async (job) => {
      await processReminder(job.data);
    });

    isRedisOnline = true;
    console.log("🚀 Bull & Redis Veterinary Reminder queue loaded successfully!");
  } catch (err) {
    console.warn("⚠️ Redis or 'bull' module not available. Initialized resilient in-memory veterinary reminder backup.");
    isRedisOnline = false;
  }

  // ⚡ Auto-Trigger initial clinical audit upon startup
  console.log("⚡ [Reminder Service] Boot-time automated clinical reminders audit triggered.");
  runAutomatedRemindersAudit().catch(err => {
    console.error("❌ Error running startup reminders audit:", err.message);
  });

  // ⏰ Setup background interval to run the automated reminders scan every 2 hours
  setInterval(() => {
    runAutomatedRemindersAudit().catch(err => {
      console.error("❌ Error running recurring reminders audit:", err.message);
    });
  }, 2 * 60 * 60 * 1000); // 2 hours
}

/**
 * Run dynamic database scans for all scheduled reminders and transition statuses
 */
export async function runAutomatedRemindersAudit() {
  console.log('\n⏳ [Reminder Service] Initiating automated clinical alerts & reminders audit...');
  
  try {
    const todayStr = getLocalDateStringOffset(0);
    const tomorrowStr = getLocalDateStringOffset(1);
    
    // 1. 24hr Upcoming Appointment Reminder Scan
    console.log(`   🔍 Scanning for appointments scheduled for tomorrow: ${tomorrowStr}`);
    const upcomingAppts = await Appointment.find({
      date: tomorrowStr,
      status: 'Scheduled',
      reminderSent: false
    });
    
    console.log(`   🔔 Found ${upcomingAppts.length} appointments for tomorrow requiring notifications.`);
    for (const appt of upcomingAppts) {
      try {
        const client = await Client.findOne({ name: appt.ownerName });
        const vet = await Vet.findOne({ name: appt.vetName });
        const clinic = appt.clinic_id ? await Clinic.findById(appt.clinic_id) : null;
        
        if (client) {
          await sendAppointmentReminderMail(client, appt, vet, clinic);
        }
        
        appt.reminderSent = true;
        await appt.save();
        console.log(`      ✅ Successfully sent reminder for ${appt.petName} (${appt.ownerName}) and marked flag.`);
      } catch (err) {
        console.error(`      ❌ Error sending reminder for appointment [ID: ${appt._id}]:`, err.message);
      }
    }

    // 2. Pending Follow-up Reminder Scan
    console.log('   🔍 Scanning for pending follow-ups requiring invitations...');
    const pendingFollowUps = await FollowUp.find({
      status: { $ne: 'Scheduled' },
      reminderSent: false
    });
    
    console.log(`   🔔 Found ${pendingFollowUps.length} pending follow-up records requiring invitations.`);
    for (const followUp of pendingFollowUps) {
      try {
        const client = await Client.findOne({ name: followUp.ownerName });
        const clinic = followUp.clinic_id ? await Clinic.findById(followUp.clinic_id) : null;
        
        if (client) {
          await sendPendingFollowUpReminderMail(client, followUp, clinic, null);
        }
        
        followUp.reminderSent = true;
        await followUp.save();
        console.log(`      ✅ Successfully sent pending follow-up reminder for ${followUp.petName} (${followUp.ownerName}) and marked flag.`);
      } catch (err) {
        console.error(`      ❌ Error sending reminder for follow-up [ID: ${followUp._id}]:`, err.message);
      }
    }

    // 3. Missed Appointment Scan & Auto-Status Transition
    console.log(`   🔍 Scanning for missed appointments scheduled before today: ${todayStr}`);
    const missedAppts = await Appointment.find({
      date: { $lt: todayStr },
      status: 'Scheduled'
    });
    
    console.log(`   ⚠️ Found ${missedAppts.length} missed appointments requiring status transitions & alerts.`);
    for (const appt of missedAppts) {
      try {
        appt.status = 'Missed';
        appt.reminderSent = true;
        await appt.save();
        
        const client = await Client.findOne({ name: appt.ownerName });
        const vet = await Vet.findOne({ name: appt.vetName });
        const clinic = appt.clinic_id ? await Clinic.findById(appt.clinic_id) : null;
        
        if (client) {
          await sendMissedAppointmentAlertMail(client, appt, vet, clinic);
        }
        
        console.log(`      ✅ Transitioned appointment status to 'Missed' for ${appt.petName} (${appt.ownerName}) and sent reschedule email.`);
      } catch (err) {
        console.error(`      ❌ Error processing missed status transition for appointment [ID: ${appt._id}]:`, err.message);
      }
    }

    console.log('✅ [Reminder Service] Automated clinical audit completed successfully.\n');
  } catch (err) {
    console.error('❌ [Reminder Service] Automated audit encountered critical error:', err.message);
  }
}

/**
 * Core processing logic for sending reminders
 */
async function processReminder(data) {
  const { type, petName, ownerName, details, targetId } = data;
  console.log(`\n📬 [Reminder Service] Sending automated notification to ${ownerName}:`);
  console.log(`   🐾 Pet: ${petName} | Type: ${type}`);
  console.log(`   📝 Details: ${details}`);
  
  try {
    if (type === 'vaccination') {
      const vax = await Vaccination.findById(targetId);
      if (vax) {
        const client = await Client.findOne({ name: { $regex: new RegExp('^' + ownerName.trim() + '$', 'i') } });
        if (client) {
          const clinic = vax.clinic_id ? await Clinic.findById(vax.clinic_id) : null;
          await sendVaccinationReminderMail(client, petName, vax.vaccine, vax.dueDate, clinic);
        }
      }
      await Vaccination.findByIdAndUpdate(targetId, { reminderStatus: 'Sent automatically via schedule' });
    } else if (type === 'followup') {
      await FollowUp.findByIdAndUpdate(targetId, { status: 'Notified' });
    }
    console.log(`   ✅ Notification successfully updated in database!`);
  } catch (err) {
    console.error(`   ❌ Failed to update reminder status in database:`, err.message);
  }
}

/**
 * Public method to schedule a reminder (e.g. vaccination, deworming, post-visit follow-up)
 * Supports delayed executions (e.g. 5 seconds for testing or custom millisecond delays)
 */
export async function scheduleReminder(type, petName, ownerName, details, targetId, delayMs = 10000) {
  const payload = { type, petName, ownerName, details, targetId };

  if (isRedisOnline && reminderQueue) {
    try {
      await reminderQueue.add(payload, { delay: delayMs });
      console.log(`⏰ [Bull] Delayed reminder scheduled for ${petName} in ${delayMs}ms.`);
      return;
    } catch (err) {
      console.warn("⚠️ Bull scheduling failed, falling back to in-memory scheduler:", err.message);
    }
  }

  // Resilient in-memory fallback
  console.log(`⏰ [In-Memory] Scheduling fallback reminder for ${petName} in ${delayMs}ms...`);
  setTimeout(async () => {
    try {
      await processReminder(payload);
    } catch (err) {
      console.error("❌ Fallback reminder processing failed:", err.message);
    }
  }, delayMs);
}
