import { Appointment, Client, Vet, FollowUp } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';
import Clinic from '../models/Clinic.js';
import { sendDoctorAppointmentMail, sendClientAppointmentConfirmationMail } from '../services/mailService.js';

const format12h = (t) => {
  if (!t) return '';
  if (t.includes('-')) {
    const parts = t.split('-');
    const formatSingle = (singleT) => {
      const [h, m] = singleT.split(':');
      const hr = parseInt(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const hr12 = hr % 12 || 12;
      return `${hr12}:${m} ${ampm}`;
    };
    return `${formatSingle(parts[0])} – ${formatSingle(parts[1])}`;
  }
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  const hr12 = hr % 12 || 12;
  return `${hr12}:${m} ${ampm}`;
};

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

export const bookFollowUpRoute = async (req, res, next) => {
  try {
    const { ownerName, petName, vetName, date, time, clinicId } = req.query;

    if (!ownerName || !petName || !date || !time) {
      return res.status(400).send(`
        <div style="font-family: Arial, sans-serif; padding: 40px; text-align: center; color: #ef4444;">
          <h2>❌ Missing required scheduling parameters</h2>
          <p>Please use the official link provided in your follow-up recommendation email.</p>
        </div>
      `);
    }

    // 1. Check if an appointment already exists for this slot to prevent double-booking
    const booked = await Appointment.find({
      date,
      vetName: vetName || 'Dr. Sarah Chen',
      status: { $ne: 'Cancelled' }
    }).lean();

    const isBooked = booked.some(appt => {
      const apptTime = appt.time.replace(/\s*[AP]M\s*$/i, '');
      const apptStart = apptTime.includes('-') ? apptTime.split('-')[0] : apptTime;
      const slotStart = time.includes('-') ? time.split('-')[0] : time;
      return (apptTime === time || apptStart === slotStart);
    });

    if (isBooked) {
      return res.status(409).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Slot Already Booked</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; }
            .card { background: white; max-width: 480px; width: 100%; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e2e8f0; }
            .icon { font-size: 48px; margin-bottom: 16px; }
            h2 { margin: 0 0 12px 0; color: #ea580c; }
            p { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0; }
            .btn { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; transition: background 0.2s; }
            .btn:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">⚠️</div>
            <h2>Slot Unavailable</h2>
            <p>We are sorry, but the slot on <strong>${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${time}</strong> has already been reserved by another client. Please check your email for other slots or contact the clinic.</p>
            <a href="${process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000'}" class="btn">Back to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    // 2. Create the follow-up appointment in database
    const apptBody = {
      petName,
      ownerName,
      vetName: vetName || 'Dr. Sarah Chen',
      reason: 'Recommended Follow-up Visit',
      date,
      time,
      type: 'Follow-up',
      status: 'Scheduled'
    };

    if (clinicId) {
      apptBody.clinic_id = clinicId;
    }

    const newAppt = await Appointment.create(apptBody);

    // 3. Create or update FollowUp record in database
    const existingFollowUp = await FollowUp.findOne({
      ownerName: { $regex: new RegExp('^' + ownerName.trim() + '$', 'i') },
      petName: { $regex: new RegExp('^' + petName.trim() + '$', 'i') },
      status: { $ne: 'Scheduled' }
    });

    if (existingFollowUp) {
      existingFollowUp.vetName = vetName || 'Dr. Sarah Chen';
      existingFollowUp.planDate = date;
      existingFollowUp.confirmedDate = date;
      existingFollowUp.time = time;
      existingFollowUp.status = 'Scheduled';
      if (clinicId) {
        existingFollowUp.clinic_id = clinicId;
      }
      await existingFollowUp.save();
      console.log(`🔄 Updated existing FollowUp record: [ID: ${existingFollowUp._id}]`);
    } else {
      const followUpBody = {
        petName,
        ownerName,
        vetName: vetName || 'Dr. Sarah Chen',
        purpose: 'Recommended Follow-up',
        planDate: date,
        confirmedDate: date,
        time: time,
        priority: 'Routine',
        status: 'Scheduled',
        monitoring: false
      };
      if (clinicId) {
        followUpBody.clinic_id = clinicId;
      }
      const newFollowUp = await FollowUp.create(followUpBody);
      console.log(`🆕 Created new FollowUp record: [ID: ${newFollowUp._id}]`);
    }

    // 4. Send Confirmation Emails
    const client = await Client.findOne({ name: ownerName });
    const vet = await Vet.findOne({ name: vetName || 'Dr. Sarah Chen' });
    const clinic = clinicId ? await Clinic.findById(clinicId) : null;

    if (client) {
      await sendClientAppointmentConfirmationMail(client, newAppt, vet, clinic);
    }
    if (vet) {
      await sendDoctorAppointmentMail(vet, newAppt, client, clinic);
    }

    // 5. Render a premium confirmation screen
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Appointment Confirmed!</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f0fdf4; color: #1e293b; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; }
          .card { background: white; max-width: 480px; width: 100%; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05); text-align: center; border: 1px solid #bbf7d0; }
          .icon { font-size: 56px; color: #16a34a; margin-bottom: 16px; animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
          h2 { margin: 0 0 8px 0; color: #15803d; }
          .pet-badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: bold; font-size: 12px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 20px; }
          p { font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; }
          .details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: left; font-size: 13.5px; margin-bottom: 24px; }
          .details-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
          .details-row:last-child { border-bottom: none; }
          .details-label { color: #64748b; font-weight: 600; }
          .details-val { color: #1e293b; font-weight: 700; }
          .btn { display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; transition: background 0.2s; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.2); }
          .btn:hover { background: #15803d; }
          @keyframes scaleIn {
            0% { transform: scale(0); }
            100% { transform: scale(1); }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>Follow-up Confirmed!</h2>
          <div class="pet-badge">🐾 Patient: ${petName}</div>
          <p>Thank you, <strong>${ownerName}</strong>. Your follow-up appointment has been successfully scheduled and synced in our clinic database.</p>
          
          <div class="details">
            <div class="details-row">
              <span class="details-label">Pet Patient:</span>
              <span class="details-val">${petName}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Owner Name:</span>
              <span class="details-val">${ownerName}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Veterinarian:</span>
              <span class="details-val">Dr. ${vet ? vet.name : (vetName || 'Sarah Chen')}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Clinic:</span>
              <span class="details-val">${clinic ? clinic.name : 'PawChart Veterinary Center'}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Date:</span>
              <span class="details-val">${new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Time Slot:</span>
              <span class="details-val">${format12h(time)}</span>
            </div>
            <div class="details-row">
              <span class="details-label">Type:</span>
              <span class="details-val">Recommended Follow-up</span>
            </div>
            <div class="details-row">
              <span class="details-label">Status:</span>
              <span class="details-val" style="color: #16a34a; font-weight: 800;">Follow-up Confirmed</span>
            </div>
          </div>

          <a href="${process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000'}" class="btn">Return to Dashboard</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
};
