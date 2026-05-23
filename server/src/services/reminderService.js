import { Vaccination, FollowUp } from '../models.js';

let Queue = null;
let reminderQueue = null;
let isRedisOnline = false;

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

    // Check for redis connection error
    reminderQueue.on('error', (err) => {
      console.warn("⚠️ Redis connection failed. Switched to offline in-memory reminder backup scheduler.");
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
