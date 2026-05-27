import 'dotenv/config';
import { connectDb } from './config/db.js';
import mongoose from 'mongoose';
import { Appointment, Client, Vet, SoapNote, FollowUp } from './models.js';
import Clinic from './models/Clinic.js';
import { triggerMailFlows } from './services/mailService.js';
import { bookFollowUpRoute } from './controllers/appointmentController.js';

async function runEmailFlowTest() {
  console.log('🧪 ===================================================');
  console.log('🧪 PAWCHART EMAIL WORKFLOW & BOOKING STABILITY AUDIT');
  console.log('🧪 ===================================================\n');

  try {
    // 1. Establish database connection
    await connectDb();

    // 2. Setup/Locate reference Clinic
    let clinic = await Clinic.findOne({});
    if (!clinic) {
      console.log('ℹ️ No clinic found. Seeding a clinical anchor record...');
      clinic = await Clinic.create({
        name: 'PawChart Reference Veterinary Center',
        code: 'PAW-REF-01',
        address: {
          street: '123 Pet Wellness Lane',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94107'
        },
        contact: {
          phone: '(555) 123-4567',
          email: 'support@pawchart.com'
        },
        specialties: 'Surgery, Veterinary Medicine, Multi-Species Primary Care'
      });
    }
    console.log(`📍 Using Clinic Anchor: "${clinic.name}" [ID: ${clinic._id}]`);

    // 3. Setup/Locate Doctor
    let vet = await Vet.findOne({ email: 'tech@saturnnri.com' });
    if (!vet) {
      console.log('ℹ️ Preloading reference veterinarian...');
      vet = await Vet.findOne({ name: 'Dr. Sarah Chen' });
      if (vet) {
        vet.email = 'tech@saturnnri.com';
        await vet.save();
      } else {
        vet = await Vet.create({
          name: 'Dr. Sarah Chen',
          email: 'tech@saturnnri.com',
          phone: '(555) 987-6543',
          specialization: 'Veterinary Medicine',
          license: 'DVM-2026-904',
          experienceYears: 8,
          consultationFee: 75,
          status: 'Available',
          room: 'Exam Room A',
          clinic_id: clinic._id
        });
      }
    }
    console.log(`👨‍⚕️ Using Veterinarian Reference: "${vet.name}" [Email: ${vet.email}]`);

    // 4. Setup/Locate Client Account
    let client = await Client.findOne({ email: 'tech@saturnnri.com' });
    if (!client) {
      console.log('ℹ️ Preloading reference client & pet records...');
      client = await Client.findOne({ name: 'Jane Smith' });
      if (client) {
        client.email = 'tech@saturnnri.com';
        await client.save();
      } else {
        client = await Client.create({
          name: 'Jane Smith',
          email: 'tech@saturnnri.com',
          phone: '(555) 234-5678',
          address: '456 Barking Heights, San Francisco CA',
          clinic_id: clinic._id,
          pets: [{
            name: 'Buddy',
            species: 'Dog',
            breed: 'Golden Retriever',
            emoji: '🐶',
            age: '2 yrs',
            sex: 'Male',
            color: 'Golden',
            microchip: '985112002345901',
            weightRange: '68 lbs',
            petId: 'PET-2026-1024',
            dateOfBirth: '2024-03-12',
            insurance: 'Healthy Paws Co.',
            primaryVet: 'Dr. Sarah Chen',
            bloodType: 'DEA 1.1 Positive',
            spayedNeutered: 'Yes'
          }]
        });
      }
    }
    console.log(`👤 Using Client Reference: "${client.name}" [Email: ${client.email}]`);

    // Ensure database indices have synced
    await new Promise(r => setTimeout(r, 1000));

    // 5. TEST CASE 1: New Appointment Booked (Doctor Mail + Client Confirmation)
    console.log('\n--- 📂 TEST CASE 1: Appointment Booked Mail Trigger ---');
    const mockAppt = {
      petName: 'Buddy',
      ownerName: client.name,
      species: 'Dog',
      breed: 'Golden Retriever',
      vetName: vet.name,
      reason: 'Annual Checkup & Rabies Shot Booster',
      date: '2026-06-15',
      time: '10:30 AM',
      type: 'Checkup',
      status: 'Scheduled',
      clinic_id: clinic._id
    };

    console.log('🚀 Triggering triggerMailFlows for appointments...');
    await triggerMailFlows('appointments', mockAppt, clinic._id, 'localhost:5000');
    console.log('✅ Appointment mail workflows successfully executed!');

    // 6. TEST CASE 2: SOAP Approved with Recheck Triggering Summary & Follow-Up Slots Invitation
    console.log('\n--- 🩺 TEST CASE 2: SOAP Approved & Follow-up Invitation Mail Trigger ---');
    const mockSoap = {
      petName: 'Buddy',
      ownerName: client.name,
      vetName: vet.name,
      subjective: 'Owner reports slight head scratching. Buddy remains playful, good appetite.',
      objective: 'Temp 101.8 F. Left ear shows mild erythema. Moderate ceruminous debris present.',
      assessment: 'Mild Otitis Externa',
      plan: 'Clean left ear. Apply Otomax drops twice daily for 7 days. Recheck/follow-up in 14 days to verify resolution.',
      tags: ['Ear', 'Follow-up'],
      clinic_id: clinic._id
    };

    console.log('🚀 Triggering triggerMailFlows for soapnotes...');
    await triggerMailFlows('soapnotes', mockSoap, clinic._id, 'localhost:5000');
    console.log('✅ SOAP and Follow-Up invitation flows successfully executed!');

    // 7. TEST CASE 3: Follow-Up Slot Confirmation Click Flow (Success Case)
    console.log('\n--- ⚡ TEST CASE 3: Follow-Up Slot Confirmation Click Flow ---');
    
    // Clear any previous test appointments for this specific date/time slot to ensure clean run
    const testDate = '2026-06-20';
    const testTime = '09:30';
    await Appointment.deleteMany({ date: testDate, time: testTime, vetName: vet.name });
    await FollowUp.deleteMany({ planDate: testDate, time: testTime, vetName: vet.name });

    console.log(`📅 Attempting follow-up booking for ${testDate} at ${testTime}...`);

    let successResponseHtml = '';
    const mockReq = {
      query: {
        ownerName: client.name,
        petName: 'Buddy',
        vetName: vet.name,
        date: testDate,
        time: testTime,
        clinicId: clinic._id.toString()
      }
    };

    const mockRes = {
      send: (html) => {
        successResponseHtml = html;
        console.log('🟢 [Success Response]: Confirm success rendering received!');
      },
      status: (code) => {
        console.log(`🟠 [Status Code]: ${code}`);
        return {
          send: (html) => {
            successResponseHtml = html;
            console.log('🔴 [Error Response]: Error rendering received!');
          }
        };
      }
    };

    // Trigger confirmation route
    await bookFollowUpRoute(mockReq, mockRes, (err) => console.error('Next error triggered:', err));

    // Verify document creation
    const dbAppt = await Appointment.findOne({ date: testDate, time: testTime, ownerName: client.name });
    const dbFollowUp = await FollowUp.findOne({ planDate: testDate, time: testTime, ownerName: client.name });

    if (dbAppt && dbFollowUp) {
      console.log('✅ Real Database Sync Success:');
      console.log(`   - Appointment Created: [ID: ${dbAppt._id}] [Status: ${dbAppt.status}]`);
      console.log(`   - Follow-Up Created: [ID: ${dbFollowUp._id}] [Status: ${dbFollowUp.status}]`);
    } else {
      throw new Error('❌ Failed to locate created Appointment or Follow-Up record in MongoDB!');
    }

    // 8. TEST CASE 4: Prevent Double-Booking (Failure Case)
    console.log('\n--- 🚫 TEST CASE 4: Double-Booking / Slot Conflict Prevention ---');
    console.log(`📅 Re-triggering booking request for same slot (${testDate} at ${testTime}) by duplicate click...`);

    let conflictResponseHtml = '';
    const mockConflictRes = {
      send: (html) => {
        conflictResponseHtml = html;
        console.log('🟢 [Response]: Renders page...');
      },
      status: (code) => {
        console.log(`🚫 [Validation Blocked]: Double-booking successfully caught with Status Code: ${code}`);
        return {
          send: (html) => {
            conflictResponseHtml = html;
            console.log('🔴 [Error Response]: Unavailable warning page rendered!');
          }
        };
      }
    };

    await bookFollowUpRoute(mockReq, mockConflictRes, (err) => console.error('Next error:', err));

    if (conflictResponseHtml.includes('Slot Unavailable') || conflictResponseHtml.includes('Slot Already Booked')) {
      console.log('✅ Double-Booking prevention checks completed perfectly!');
    } else {
      throw new Error('❌ Double-booking checks failed to intercept duplicate slot requests!');
    }

    // 9. TEST CASE 5: Automated Reminders & Alerts Scheduler Audit (Upcoming, Missed, Pending)
    console.log('\n--- ⏰ TEST CASE 5: Automated Reminders & Alerts Scheduler Audit ---');
    
    // Timezone-resilient Date calculation helper
    function getLocalDateStringOffset(offsetDays = 0) {
      const date = new Date();
      date.setDate(date.getDate() + offsetDays);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    const tomorrowStr = getLocalDateStringOffset(1);
    const yesterdayStr = getLocalDateStringOffset(-1);

    // Clean any prior scheduler test records
    await Appointment.deleteMany({ reason: 'TEST-SCHEDULER' });
    await FollowUp.deleteMany({ purpose: 'TEST-SCHEDULER' });

    console.log('📝 Preloading test records for upcoming, missed, and pending states...');
    
    // A. Tomorrow's Upcoming Appointment (Expect: sendAppointmentReminderMail)
    const upcomingApptTest = await Appointment.create({
      petName: 'Buddy',
      ownerName: client.name,
      vetName: vet.name,
      reason: 'TEST-SCHEDULER',
      date: tomorrowStr,
      time: '10:00 AM',
      type: 'Checkup',
      status: 'Scheduled',
      reminderSent: false,
      clinic_id: clinic._id
    });

    // B. Yesterday's Missed Appointment (Expect: status -> 'Missed' + sendMissedAppointmentAlertMail)
    const missedApptTest = await Appointment.create({
      petName: 'Buddy',
      ownerName: client.name,
      vetName: vet.name,
      reason: 'TEST-SCHEDULER',
      date: yesterdayStr,
      time: '14:30',
      type: 'Checkup',
      status: 'Scheduled',
      reminderSent: false,
      clinic_id: clinic._id
    });

    // C. Pending Follow-Up Invitation (Expect: sendPendingFollowUpReminderMail)
    const pendingFollowUpTest = await FollowUp.create({
      petName: 'Buddy',
      ownerName: client.name,
      vetName: vet.name,
      purpose: 'TEST-SCHEDULER',
      planDate: tomorrowStr,
      confirmedDate: '',
      time: '11:00',
      priority: 'Routine',
      status: 'Pending',
      reminderSent: false,
      clinic_id: clinic._id
    });

    console.log('🚀 Triggering runAutomatedRemindersAudit() from reminderService...');
    const { runAutomatedRemindersAudit } = await import('./services/reminderService.js');
    await runAutomatedRemindersAudit();

    // D. Verify results
    const verifiedUpcoming = await Appointment.findById(upcomingApptTest._id);
    const verifiedMissed = await Appointment.findById(missedApptTest._id);
    const verifiedFollowUp = await FollowUp.findById(pendingFollowUpTest._id);

    if (verifiedUpcoming.reminderSent && verifiedUpcoming.status === 'Scheduled') {
      console.log('   ✅ Upcoming Appointment reminder flag updated successfully.');
    } else {
      throw new Error('❌ Failed to update reminderSent flag on tomorrow\'s upcoming appointment!');
    }

    if (verifiedMissed.reminderSent && verifiedMissed.status === 'Missed') {
      console.log('   ✅ Yesterday\'s missed appointment transitioned to status \'Missed\' and flag updated.');
    } else {
      throw new Error('❌ Failed to auto-transition yesterday\'s appointment to status \'Missed\'!');
    }

    if (verifiedFollowUp.reminderSent) {
      console.log('   ✅ Pending Follow-Up invitation reminder flag updated successfully.');
    } else {
      throw new Error('❌ Failed to update reminderSent flag on pending Follow-Up invitation!');
    }

    // Clean up test entries
    await Appointment.deleteMany({ reason: 'TEST-SCHEDULER' });
    await FollowUp.deleteMany({ purpose: 'TEST-SCHEDULER' });
    console.log('🧹 Cleaned up scheduler test entries.');

    console.log('\n🌟 ===================================================');
    console.log('🌟 ALL 5 EMAIL, SCHEDULING & SCHEDULER TESTS PASSED!');
    console.log('🌟 ===================================================\n');

  } catch (error) {
    console.error('\n❌ Integration Audit Failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection disconnected cleanly. Exiting test.');
  }
}

runEmailFlowTest();
