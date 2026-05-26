import nodemailer from 'nodemailer';
import { Client, Vet } from '../models.js';
import Clinic from '../models/Clinic.js';

let transporter = null;
let etherealAccount = null;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: port == 465,
      auth: { user, pass }
    });
    console.log(`✅ Mailer initialized with production SMTP host: ${host}`);
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
      from: process.env.SMTP_FROM || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
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
      from: process.env.SMTP_FROM || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
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
      from: process.env.SMTP_FROM || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
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

/**
 * 4. Send Follow-Up Recommendation Mail
 */
export async function sendFollowUpRecommendationMail(client, soapNote, vet, clinic, host) {
  try {
    const transport = await getTransporter();
    
    // Generate 4 dynamic upcoming slots:
    // Slot 1: Tomorrow at 09:30 (9:30 AM - 10:00 AM)
    // Slot 2: Tomorrow at 11:00 (11:00 AM - 11:30 AM)
    // Slot 3: Day after tomorrow at 14:30 (2:30 PM - 3:00 PM)
    // Slot 4: Day after tomorrow at 16:00 (4:00 PM - 4:30 PM)
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];
    
    const slots = [
      { date: tomorrowStr, time: '09:30', label: `${tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at 9:30 AM – 10:00 AM` },
      { date: tomorrowStr, time: '11:00', label: `${tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at 11:00 AM – 11:30 AM` },
      { date: dayAfterStr, time: '14:30', label: `${dayAfter.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at 2:30 PM – 3:00 PM` },
      { date: dayAfterStr, time: '16:00', label: `${dayAfter.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at 4:00 PM – 4:30 PM` }
    ];

    const baseUrl = host ? `http://${host}` : (process.env.CLIENT_ORIGIN || 'http://localhost:5000');
    
    const slotsHtml = slots.map(slot => {
      const bookUrl = `${baseUrl}/api/appointments/book-followup?ownerName=${encodeURIComponent(client.name)}&petName=${encodeURIComponent(soapNote.petName)}&vetName=${encodeURIComponent(vet ? vet.name : soapNote.vetName)}&date=${slot.date}&time=${slot.time}&clinicId=${clinic ? clinic._id : ''}`;
      return `
        <div style="margin-bottom: 12px; text-align: center;">
          <a href="${bookUrl}" style="display: inline-block; width: 100%; max-width: 320px; padding: 12px 16px; background: #ea580c; color: #fff; text-decoration: none; font-weight: 700; font-size: 13.5px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); transition: background-color 0.2s;">
            ${slot.label}
          </a>
        </div>
      `;
    }).join('');

    const mailOptions = {
      from: process.env.SMTP_FROM || (etherealAccount ? etherealAccount.user : 'noreply@pawchart.com'),
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
            
            <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">Please click on a convenient 30-minute slot below to book and automatically confirm your appointment in our dashboard system:</p>

            <div style="margin: 24px 0;">
              ${slotsHtml}
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 14px; border-radius: 6px; font-size: 12px; color: #64748b; text-align: center;">
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
