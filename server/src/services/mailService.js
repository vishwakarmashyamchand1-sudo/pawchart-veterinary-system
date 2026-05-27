import nodemailer from 'nodemailer';
import { Client, Vet, FollowUp, Appointment } from '../models.js';
import Clinic from '../models/Clinic.js';

let transporter = null;
let etherealAccount = null;

function getServerUrl(host) {
  if (process.env.SERVER_URL) {
    return process.env.SERVER_URL.replace(/\/$/, '');
  }
  if (host) {
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('192.168.') || host.includes('10.') ? 'http' : 'https';
    return `${protocol}://${host}`;
  }
  return process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.replace(/\/$/, '') : 'http://localhost:5000';
}

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || (process.env.SMTP_USER || process.env.EMAIL_USER ? 'smtp.gmail.com' : null);
  const port = process.env.SMTP_PORT || 465;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;

  if (host && user && pass) {
    try {
      transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: port == 465,
        auth: { user, pass }
      });
      console.log(`✅ Mailer initialized with production SMTP host: ${host} | Port: ${port} | User: ${user}`);
    } catch (err) {
      console.error("❌ Failed to initialize production SMTP transporter:", err.message);
      transporter = {
        sendMail: async (options) => {
          console.log("📭 [Offline Transporter Mock] Sending email:", options.subject);
          return { messageId: 'offline-mock-id' };
        }
      };
    }
  } else {
    console.log("ℹ️ No SMTP credentials in .env. Automatically generating a dynamic Ethereal SMTP test account...");
    try {
      etherealAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: etherealAccount.user,
          pass: etherealAccount.pass
        }
      });
      console.log("==================================================================");
      console.log("🚀 Nodemailer Ethereal SMTP Test Account Generated successfully:");
      console.log(`   User: ${etherealAccount.user}`);
      console.log(`   Pass: ${etherealAccount.pass}`);
      console.log("==================================================================");
    } catch (err) {
      console.error("❌ Failed to create Ethereal SMTP test account:", err.message);
      // Fail-safe dummy transporter
      transporter = {
        sendMail: async (options) => {
          console.log("📭 [Offline Transporter Mock] Sending email:", options.subject);
          return { messageId: 'offline-mock-id' };
        }
      };
    }
  }
  return transporter;
}

/**
 * 1. Send Doctor Appointment Notification Mail
 */
export async function sendDoctorAppointmentMail(vet, appt, client, clinic) {
  try {
    const transport = await getTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
      to: vet.email || 'doctor@pawchart.com',
      subject: `🐾 New Appointment Scheduled: ${appt.petName} (${appt.reason})`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #1e293b; color: #fff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">🐾 New Appointment Scheduled</h2>
          </div>
          <div style="padding: 24px; background: #fff;">
            <p style="font-size: 15px; margin-top: 0;">Hi Dr. <strong>${vet.name}</strong>,</p>
            <p style="font-size: 14px;">You have a new patient appointment booked at your clinic.</p>
            
            <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 120px;">Patient Pet:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${appt.petName} (${appt.species || 'Dog'} · ${appt.breed || 'N/A'})</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Owner:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${client ? client.name : appt.ownerName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date & Time:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${appt.time}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Reason:</td>
                  <td style="padding: 6px 0; color: #e11d48; font-weight: 700;">${appt.reason}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Visit Type:</td>
                  <td style="padding: 6px 0; color: #1e293b;">${appt.type || 'Checkup'}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">Clinic Location: <strong>${clinic ? clinic.name : 'PawChart Veterinary Clinic'}</strong></p>
          </div>
          <div style="background: #f1f5f9; text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            This is an automated system notification from PawChart MERN Veterinary System.
          </div>
        </div>
      `
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✉️ [Doctor Appointment Mail] Sent to ${vet.email || 'doctor'} | Message ID: ${info.messageId}`);
    if (etherealAccount) {
      console.log(`   🔗 View Ethereal Email Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error("❌ Failed to send doctor appointment email:", err.message);
  }
}

/**
 * 2. Send Client Appointment Confirmation Mail
 */
export async function sendClientAppointmentConfirmationMail(client, appt, vet, clinic) {
  try {
    const transport = await getTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
      to: client.email || 'client@pawchart.com',
      subject: `📅 Appointment Confirmed: ${appt.petName}'s Visit on ${new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #0d9488; color: #fff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">📅 Appointment Confirmed!</h2>
          </div>
          <div style="padding: 24px; background: #fff;">
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${client.name}</strong>,</p>
            <p style="font-size: 14px;">Your appointment for <strong>${appt.petName}</strong> at <strong>${clinic ? clinic.name : 'PawChart Veterinary Clinic'}</strong> has been scheduled and confirmed successfully.</p>
            
            <div style="background: #f0fdfa; border-left: 4px solid #0d9488; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                <tr>
                  <td style="padding: 6px 0; color: #0f766e; font-weight: 600; width: 120px;">Patient:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-weight: 700;">${appt.petName} (${appt.species || 'Dog'} · ${appt.breed || 'N/A'})</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #0f766e; font-weight: 600;">Veterinarian:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-weight: 700;">Dr. ${vet ? vet.name : appt.vetName || 'Sarah Chen'}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #0f766e; font-weight: 600;">Date & Time:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-weight: 700;">${new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${appt.time}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #0f766e; font-weight: 600;">Reason:</td>
                  <td style="padding: 6px 0; color: #1f2937;">${appt.reason}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #0f766e; font-weight: 600;">Clinic Location:</td>
                  <td style="padding: 6px 0; color: #1f2937; font-size: 12.5px;">
                    ${clinic ? `${clinic.name}<br/>${clinic.address.street}, ${clinic.address.city}, ${clinic.address.state} - ${clinic.address.postal_code}` : 'PawChart Veterinary Center'}
                  </td>
                </tr>
              </table>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; font-size: 13px; color: #b45309;">
              ⚠️ <strong>Arrive Early Reminder:</strong> Please arrive at least <strong>10–15 minutes early</strong> to allow for patient check-in, vitals checking, and check-up preparation.
            </div>

            <p style="font-size: 13.5px; margin-bottom: 0;">Need to cancel or reschedule? Please call us at <strong>${clinic ? clinic.contact.phone : 'our office'}</strong> or visit the clinic dashboard.</p>
          </div>
          <div style="background: #f1f5f9; text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Thank you for choosing PawChart! We are excited to care for your beloved pet.
          </div>
        </div>
      `
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✉️ [Client Appointment Confirmation] Sent to ${client.email} | Message ID: ${info.messageId}`);
    if (etherealAccount) {
      console.log(`   🔗 View Ethereal Email Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error("❌ Failed to send client appointment confirmation email:", err.message);
  }
}

/**
 * 3. Send Consultation Summary Mail
 */
export async function sendConsultationSummaryMail(client, soapNote, vet, clinic) {
  try {
    const transport = await getTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
      to: client.email || 'client@pawchart.com',
      subject: `🩺 Consultation Summary: ${soapNote.petName}'s Visit Today`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #2563eb; color: #fff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">🩺 Clinical Consultation Summary</h2>
            <div style="font-size: 12.5px; opacity: 0.85; margin-top: 4px;">Patient: ${soapNote.petName} · Practitioner: Dr. ${vet ? vet.name : soapNote.vetName}</div>
          </div>
          <div style="padding: 24px; background: #fff;">
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${client.name}</strong>,</p>
            <p style="font-size: 14px;">Here are the medical documentation summary and treatment recommendations from <strong>${soapNote.petName}</strong>'s checkup today with Dr. <strong>${vet ? vet.name : soapNote.vetName}</strong> at <strong>${clinic ? clinic.name : 'our clinic'}</strong>.</p>
            
            <div style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 700; font-size: 13.5px; color: #1e293b;">
                📋 SOAP Medical Records
              </div>
              <div style="padding: 16px; font-size: 13px;">
                <div style="margin-bottom: 12px;">
                  <strong style="color: #2563eb; text-transform: uppercase; font-size: 11px; display: block;">Subjective (Symptoms Reported):</strong>
                  <div style="color: #334155; margin-top: 2px;">${soapNote.subjective || 'N/A'}</div>
                </div>
                <div style="margin-bottom: 12px;">
                  <strong style="color: #2563eb; text-transform: uppercase; font-size: 11px; display: block;">Objective (Exam Findings):</strong>
                  <div style="color: #334155; margin-top: 2px;">${soapNote.objective || 'N/A'}</div>
                </div>
                <div style="margin-bottom: 12px;">
                  <strong style="color: #2563eb; text-transform: uppercase; font-size: 11px; display: block;">Clinical Diagnosis Assessment:</strong>
                  <div style="color: #1e293b; font-weight: 700; margin-top: 2px;">${soapNote.assessment || 'N/A'}</div>
                </div>
                <div>
                  <strong style="color: #2563eb; text-transform: uppercase; font-size: 11px; display: block;">Plan & Medication Prescriptions:</strong>
                  <div style="color: #334155; margin-top: 2px; padding: 8px 10px; background: #eff6ff; border-radius: 4px; border-left: 3px solid #2563eb;">
                    ${soapNote.plan || 'Standard care monitoring.'}
                  </div>
                </div>
              </div>
            </div>

            <p style="font-size: 13.5px; color: #475569;">If any prescriptions were listed, please collect them from the front desk or follow your local pharmacist guidance. Please monitor your pet's recovery carefully.</p>
          </div>
          <div style="background: #f1f5f9; text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Thank you for trusting PawChart. We wish ${soapNote.petName} a speedy and happy recovery!
          </div>
        </div>
      `
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✉️ [Consultation Summary Mail] Sent to ${client.email} | Message ID: ${info.messageId}`);
    if (etherealAccount) {
      console.log(`   🔗 View Ethereal Email Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error("❌ Failed to send consultation summary email:", err.message);
  }
}

function format12h(t) {
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
}

function isSlotBooked(slot, bookedAppointments) {
  return bookedAppointments.some(appt => {
    const apptTime = appt.time.replace(/\s*[AP]M\s*$/i, '');
    const apptStart = apptTime.includes('-') ? apptTime.split('-')[0] : apptTime;
    const slotStart = slot.includes('-') ? slot.split('-')[0] : slot;
    return (apptTime === slot || apptStart === slotStart);
  });
}

/**
 * 4. Send Follow-Up Recommendation Mail
 */
export async function sendFollowUpRecommendationMail(client, soapNote, vet, clinic, host) {
  try {
    const transport = await getTransporter();
    
    // Generate all 18 potential 30-minute slots between 09:00 and 18:00
    const allSlots = [];
    let startHour = 9;
    let startMin = 0;
    while (startHour < 18) {
      const sh = String(startHour).padStart(2, '0');
      const sm = String(startMin).padStart(2, '0');
      
      let endMin = startMin + 30;
      let endHour = startHour;
      if (endMin >= 60) {
        endMin = 0;
        endHour += 1;
      }
      const eh = String(endHour).padStart(2, '0');
      const em = String(endMin).padStart(2, '0');
      
      allSlots.push(`${sh}:${sm}-${eh}:${em}`);
      
      startHour = endHour;
      startMin = endMin;
    }

    // Determine follow-up target date (YYYY-MM-DD or whatever is chosen)
    const targetDate = soapNote.follow_up_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Query already booked slots for this doctor/date in the DB
    const booked = await Appointment.find({
      date: targetDate,
      vetName: (vet ? vet.name : soapNote.vetName) || 'Dr. Sarah Chen',
      status: { $ne: 'Cancelled' }
    }).lean();

    // Filter available slots
    const availableSlots = allSlots.filter(slot => !isSlotBooked(slot, booked));

    const baseUrl = getServerUrl(host);
    
    const formattedDate = targetDate.includes('-') 
      ? new Date(targetDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : targetDate;

    let slotsHtml = '';
    if (availableSlots.length === 0) {
      slotsHtml = `
        <div style="padding: 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; color: #b45309; text-align: center; font-size: 14px; margin: 20px 0;">
          ⚠️ No standard time slots are currently available on this date. Please contact the clinic dashboard to schedule a custom slot.
        </div>
      `;
    } else {
      const columns = 3;
      const rowsCount = Math.ceil(availableSlots.length / columns);
      slotsHtml = '<table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin: 10px 0;">';
      
      for (let r = 0; r < rowsCount; r++) {
        slotsHtml += '<tr>';
        for (let c = 0; c < columns; c++) {
          const idx = r * columns + c;
          if (idx < availableSlots.length) {
            const slot = availableSlots[idx];
            const bookUrl = `${baseUrl}/api/appointments/book-followup?ownerName=${encodeURIComponent(client.name)}&petName=${encodeURIComponent(soapNote.petName)}&vetName=${encodeURIComponent(vet ? vet.name : soapNote.vetName)}&date=${targetDate}&time=${slot}&clinicId=${clinic ? clinic._id : ''}`;
            const label = format12h(slot);
            slotsHtml += `
              <td style="width: 33.33%; text-align: center; padding: 0;">
                <a href="${bookUrl}" style="display: block; padding: 12px 4px; background: #ea580c; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); text-align: center; border: 1px solid #ea580c;">
                  ${label}
                </a>
              </td>
            `;
          } else {
            slotsHtml += '<td style="width: 33.33%;"></td>';
          }
        }
        slotsHtml += '</tr>';
      }
      slotsHtml += '</table>';
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
      to: client.email || 'client@pawchart.com',
      subject: `⚡ Follow-up Recommended: Book ${soapNote.petName}'s Next Visit`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #ea580c; color: #fff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">⚡ Follow-up Recommended</h2>
            <div style="font-size: 12.5px; opacity: 0.9; margin-top: 4px;">Patient: ${soapNote.petName} · Veterinary Surgeon: Dr. ${vet ? vet.name : soapNote.vetName}</div>
          </div>
          <div style="padding: 24px; background: #fff;">
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${client.name}</strong>,</p>
            <p style="font-size: 14px;">Following today's consultation, Dr. <strong>${vet ? vet.name : soapNote.vetName}</strong> has recommended a follow-up visit for <strong>${soapNote.petName}</strong> to monitor their recovery.</p>
            
            <div style="background: #f8fafc; border-left: 4px solid #ea580c; padding: 18px; margin: 20px 0; border-radius: 6px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🐾 Consultation Summary</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; line-height: 1.6;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600; width: 110px;">Patient Pet:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: 700;">${soapNote.petName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Owner:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: 600;">${client.name}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Veterinarian:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: 600;">Dr. ${vet ? vet.name : soapNote.vetName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Clinic:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: 600;">${clinic ? clinic.name : 'PawChart Veterinary Clinic'}</td>
                </tr>
              </table>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0;">
              <span style="font-size: 13px; color: #b45309; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Target Follow-Up Date</span>
              <strong style="font-size: 20px; color: #78350f; font-weight: 800;">${formattedDate}</strong>
            </div>

            <p style="font-size: 14px; color: #475569; margin-bottom: 12px;">Please click on a convenient 30-minute slot below to book and automatically confirm your appointment:</p>

            <div style="margin: 16px 0;">
              ${slotsHtml}
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 14px; border-radius: 6px; font-size: 12px; color: #64748b; text-align: center; margin-top: 24px;">
              💡 <strong>Instant Sync</strong>: Clicking any slot automatically reserves it, blocks it from other clients, and adds the follow-up record to your clinic patient profile.
            </div>
          </div>
          <div style="background: #f1f5f9; text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            This follow-up booking system is powered by PawChart. We look forward to seeing ${soapNote.petName} again soon!
          </div>
        </div>
      `
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✉️ [Follow-up Recommendation Mail] Sent to ${client.email} | Message ID: ${info.messageId}`);
    if (etherealAccount) {
      console.log(`   🔗 View Ethereal Email Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error("❌ Failed to send follow-up recommendation email:", err.message);
  }
}

/**
 * 5. Send 24hr Upcoming Appointment Reminder Mail
 */
export async function sendAppointmentReminderMail(client, appt, vet, clinic) {
  try {
    const transport = await getTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
      to: client.email || 'client@pawchart.com',
      subject: `🔔 Reminder: ${appt.petName}'s Appointment Tomorrow`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #4f46e5; color: #fff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">🔔 Upcoming Appointment Reminder</h2>
          </div>
          <div style="padding: 24px; background: #fff;">
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${client.name}</strong>,</p>
            <p style="font-size: 14px;">This is a friendly reminder that <strong>${appt.petName}</strong> has an appointment scheduled for tomorrow at <strong>${clinic ? clinic.name : 'our clinic'}</strong>.</p>
            
            <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                <tr>
                  <td style="padding: 6px 0; color: #4338ca; font-weight: 600; width: 120px;">Patient:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${appt.petName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #4338ca; font-weight: 600;">Veterinarian:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">Dr. ${vet ? vet.name : appt.vetName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #4338ca; font-weight: 600;">Date & Time:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">Tomorrow (${new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}) at ${appt.time}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #4338ca; font-weight: 600;">Reason:</td>
                  <td style="padding: 6px 0; color: #1e293b;">${appt.reason}</td>
                </tr>
              </table>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; font-size: 13px; color: #b45309;">
              ⚠️ <strong>Early Check-in:</strong> Please arrive <strong>10–15 minutes early</strong> so we can check Buddy's weight, temp, and prepare the exam room.
            </div>

            <p style="font-size: 13.5px; margin-bottom: 0;">If you need to reschedule, please contact the clinic at your earliest convenience.</p>
          </div>
          <div style="background: #f1f5f9; text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Thank you for choosing PawChart! We are dedicated to providing excellent pet healthcare.
          </div>
        </div>
      `
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✉️ [24hr Appointment Reminder Mail] Sent to ${client.email} | Message ID: ${info.messageId}`);
    if (etherealAccount) {
      console.log(`   🔗 View Ethereal Email Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error("❌ Failed to send appointment reminder email:", err.message);
  }
}

/**
 * 6. Send Missed Appointment Reschedule Alert Mail
 */
export async function sendMissedAppointmentAlertMail(client, appt, vet, clinic) {
  try {
    const transport = await getTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
      to: client.email || 'client@pawchart.com',
      subject: `⚠️ Missed Appointment: ${appt.petName}'s Visit on ${new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #475569; color: #fff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">⚠️ Missed Appointment Notification</h2>
          </div>
          <div style="padding: 24px; background: #fff;">
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${client.name}</strong>,</p>
            <p style="font-size: 14px;">We missed you and <strong>${appt.petName}</strong> at the clinic today for your scheduled visit on <strong>${new Date(appt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong> at <strong>${appt.time}</strong>.</p>
            
            <div style="background: #f8fafc; border-left: 4px solid #64748b; padding: 16px; margin: 20px 0; border-radius: 4px; font-size: 13.5px; color: #475569;">
              We understand that schedules change and unexpected events happen! Keeping regular checks is highly important for tracking your pet's recovery and treatment stability.
            </div>

            <p style="font-size: 14px;">Would you like to reschedule your visit with Dr. <strong>${vet ? vet.name : appt.vetName}</strong>? Please click the button below to book a new slot:</p>

            <div style="margin: 24px 0; text-align: center;">
              <a href="${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 8px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
                Reschedule Appointment
              </a>
            </div>

            <p style="font-size: 13.5px; margin-bottom: 0;">If you have any questions or would like to talk directly with our clinical support team, please call <strong>${clinic ? clinic.contact.phone : 'our office'}</strong>.</p>
          </div>
          <div style="background: #f1f5f9; text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Thank you. PawChart Veterinary Center.
          </div>
        </div>
      `
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✉️ [Missed Appointment Reschedule Alert Mail] Sent to ${client.email} | Message ID: ${info.messageId}`);
    if (etherealAccount) {
      console.log(`   🔗 View Ethereal Email Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error("❌ Failed to send missed appointment alert email:", err.message);
  }
}

/**
 * 7. Send Pending Follow-Up Action Reminder Mail
 */
export async function sendPendingFollowUpReminderMail(client, followUp, clinic, host) {
  try {
    const transport = await getTransporter();

    // Generate all 18 potential 30-minute slots between 09:00 and 18:00
    const allSlots = [];
    let startHour = 9;
    let startMin = 0;
    while (startHour < 18) {
      const sh = String(startHour).padStart(2, '0');
      const sm = String(startMin).padStart(2, '0');
      
      let endMin = startMin + 30;
      let endHour = startHour;
      if (endMin >= 60) {
        endMin = 0;
        endHour += 1;
      }
      const eh = String(endHour).padStart(2, '0');
      const em = String(endMin).padStart(2, '0');
      
      allSlots.push(`${sh}:${sm}-${eh}:${em}`);
      
      startHour = endHour;
      startMin = endMin;
    }

    // Determine target date
    const targetDate = followUp.planDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Query already booked slots for this doctor/date in DB
    const booked = await Appointment.find({
      date: targetDate,
      vetName: followUp.vetName || 'Dr. Sarah Chen',
      status: { $ne: 'Cancelled' }
    }).lean();

    // Filter available slots
    const availableSlots = allSlots.filter(slot => !isSlotBooked(slot, booked));

    const baseUrl = getServerUrl(host);
    
    const formattedDate = targetDate.includes('-') 
      ? new Date(targetDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : targetDate;

    let slotsHtml = '';
    if (availableSlots.length === 0) {
      slotsHtml = `
        <div style="padding: 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; color: #b45309; text-align: center; font-size: 14px; margin: 20px 0;">
          ⚠️ No standard time slots are currently available on this date. Please contact the clinic dashboard to schedule a custom slot.
        </div>
      `;
    } else {
      const columns = 3;
      const rowsCount = Math.ceil(availableSlots.length / columns);
      slotsHtml = '<table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin: 10px 0;">';
      
      for (let r = 0; r < rowsCount; r++) {
        slotsHtml += '<tr>';
        for (let c = 0; c < columns; c++) {
          const idx = r * columns + c;
          if (idx < availableSlots.length) {
            const slot = availableSlots[idx];
            const bookUrl = `${baseUrl}/api/appointments/book-followup?ownerName=${encodeURIComponent(client.name)}&petName=${encodeURIComponent(followUp.petName)}&vetName=${encodeURIComponent(followUp.vetName || 'Dr. Sarah Chen')}&date=${targetDate}&time=${slot}&clinicId=${clinic ? clinic._id : ''}`;
            const label = format12h(slot);
            slotsHtml += `
              <td style="width: 33.33%; text-align: center; padding: 0;">
                <a href="${bookUrl}" style="display: block; padding: 12px 4px; background: #ea580c; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); text-align: center; border: 1px solid #ea580c;">
                  ${label}
                </a>
              </td>
            `;
          } else {
            slotsHtml += '<td style="width: 33.33%;"></td>';
          }
        }
        slotsHtml += '</tr>';
      }
      slotsHtml += '</table>';
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
      to: client.email || 'client@pawchart.com',
      subject: `🔔 Pending Follow-up Action Required for ${followUp.petName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background: #ea580c; color: #fff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">🔔 Follow-up Action Required</h2>
            <div style="font-size: 12.5px; opacity: 0.9; margin-top: 4px;">Patient: ${followUp.petName} · Practitioner: ${followUp.vetName || 'Dr. Sarah Chen'}</div>
          </div>
          <div style="padding: 24px; background: #fff;">
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${client.name}</strong>,</p>
            <p style="font-size: 14px;">We noticed that the recommended follow-up visit for <strong>${followUp.petName}</strong> is still pending.</p>
            
            <div style="background: #f8fafc; border-left: 4px solid #ea580c; padding: 18px; margin: 20px 0; border-radius: 6px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">🐾 Follow-Up Summary</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; line-height: 1.6;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600; width: 110px;">Patient Pet:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: 700;">${followUp.petName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Owner:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: 600;">${client.name}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Veterinarian:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: 600;">Dr. ${followUp.vetName || 'Sarah Chen'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Clinic:</td>
                  <td style="padding: 4px 0; color: #1e293b; font-weight: 600;">${clinic ? clinic.name : 'PawChart Veterinary Clinic'}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Purpose:</td>
                  <td style="padding: 4px 0; color: #1e293b;">${followUp.purpose || 'Recommended Follow-up Visit'}</td>
                </tr>
              </table>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0;">
              <span style="font-size: 13px; color: #b45309; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Target Follow-Up Date</span>
              <strong style="font-size: 20px; color: #78350f; font-weight: 800;">${formattedDate}</strong>
            </div>

            <p style="font-size: 14px; color: #475569; margin-bottom: 12px;">Please click on a convenient 30-minute slot below to book and automatically confirm your appointment:</p>

            <div style="margin: 16px 0;">
              ${slotsHtml}
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 14px; border-radius: 6px; font-size: 12px; color: #64748b; text-align: center; margin-top: 24px;">
              💡 <strong>Instant Sync</strong>: Clicking any slot automatically reserves it, blocks it from other clients, and updates the follow-up record in your clinic patient profile.
            </div>
          </div>
          <div style="background: #f1f5f9; text-align: center; padding: 16px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Thank you for choosing PawChart! We are dedicated to providing excellent pet healthcare.
          </div>
        </div>
      `
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✉️ [Pending Follow-Up Reminder Mail] Sent to ${client.email} | Message ID: ${info.messageId}`);
    if (etherealAccount) {
      console.log(`   🔗 View Ethereal Email Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error("❌ Failed to send pending follow-up reminder email:", err.message);
  }
}

export async function triggerMailFlows(resource, created, clinicId, host) {
  try {
    if (resource === 'appointments') {
      const appt = created;
      // Case-insensitive regex match to resolve clients securely
      const client = await Client.findOne({ 
        name: { $regex: new RegExp('^' + appt.ownerName.trim() + '$', 'i') } 
      });
      const vet = await Vet.findOne({ name: appt.vetName });
      const clinic = clinicId ? await Clinic.findById(clinicId) : null;
      
      if (vet) {
        await sendDoctorAppointmentMail(vet, appt, client, clinic);
      }
      if (client) {
        await sendClientAppointmentConfirmationMail(client, appt, vet, clinic);
      }
    } else if (resource === 'soapnotes') {
      const soapNote = created;
      // Case-insensitive regex match to resolve clients securely
      const client = await Client.findOne({ 
        name: { $regex: new RegExp('^' + soapNote.ownerName.trim() + '$', 'i') } 
      });
      const vet = await Vet.findOne({ name: soapNote.vetName });
      const clinic = clinicId ? await Clinic.findById(clinicId) : null;
      
      if (client) {
        await sendConsultationSummaryMail(client, soapNote, vet, clinic);
        
        // Parse plan / tags for follow-up recommendations with high-fidelity matching
        const planLower = (soapNote.plan || '').toLowerCase();
        const hasFollowupTag = soapNote.tags && soapNote.tags.some(t => {
          const tl = t.toLowerCase();
          return tl.includes('follow-up') || tl.includes('follow up') || tl.includes('recheck') || tl.includes('re-check');
        });
        
        const isFollowupNeeded = 
          planLower.includes('follow-up') || 
          planLower.includes('follow up') || 
          planLower.includes('recheck') || 
          planLower.includes('re-check') || 
          planLower.includes('days') || 
          planLower.includes('weeks') || 
          planLower.includes('revisit') || 
          planLower.includes('re-visit') || 
          hasFollowupTag ||
          !!soapNote.follow_up_date;
          
        if (isFollowupNeeded) {
          const targetDate = soapNote.follow_up_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          // Create or update a pending follow-up entry
          let followUp = await FollowUp.findOne({
            ownerName: { $regex: new RegExp('^' + soapNote.ownerName.trim() + '$', 'i') },
            petName: { $regex: new RegExp('^' + soapNote.petName.trim() + '$', 'i') },
            status: 'Pending'
          });
          
          if (!followUp) {
            followUp = await FollowUp.create({
              petName: soapNote.petName,
              ownerName: soapNote.ownerName,
              vetName: soapNote.vetName || 'Dr. Sarah Chen',
              purpose: soapNote.plan || 'Recommended Follow-up',
              planDate: targetDate,
              confirmedDate: '',
              time: '',
              priority: 'Routine',
              status: 'Pending',
              monitoring: false,
              clinic_id: clinicId || soapNote.clinic_id
            });
            console.log(`🆕 Created pending FollowUp entry via SOAP flow: [ID: ${followUp._id}]`);
          } else {
            followUp.planDate = targetDate;
            followUp.vetName = soapNote.vetName || 'Dr. Sarah Chen';
            followUp.purpose = soapNote.plan || 'Recommended Follow-up';
            if (clinicId || soapNote.clinic_id) {
              followUp.clinic_id = clinicId || soapNote.clinic_id;
            }
            await followUp.save();
            console.log(`🔄 Updated existing pending FollowUp entry via SOAP flow: [ID: ${followUp._id}]`);
          }

          await sendFollowUpRecommendationMail(client, soapNote, vet, clinic, host);
        }
      }
    }
  } catch (err) {
    console.error("❌ Error executing triggerMailFlows:", err.message);
  }
}
