const fs = require('fs');

const file = 'server/src/services/mailService.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /(export async function sendVaccinationReminderMail[\s\S]*?const mailOptions = \{[\s\S]*?)html: `[\s\S]*?`([\s\S]*?\}[\s]*;[\s]*const info = await transport\.sendMail\(mailOptions\);)/;

const newHtml = `html: \`
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          <div style="background: \${new Date(dueDate) < new Date() ? '#e11d48' : '#0d9488'}; color: #ffffff; padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">🐾 Pet Health Alert</h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Important medical update regarding your pet's vaccination</p>
          </div>
          
          <div style="padding: 32px 24px; background: #ffffff;">
            <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Dear <strong>\${client.name}</strong>,</p>
            
            <p style="font-size: 15px; color: #475569;">
              This is a formal notification from <strong>\${clinic ? clinic.name : 'PawChart Veterinary Clinic'}</strong> to inform you that the medical records for your beloved pet, <strong>\${petName}</strong>, indicate an outstanding vaccination requirement.
            </p>
            
            <div style="background: #f8fafc; border-left: 4px solid \${new Date(dueDate) < new Date() ? '#e11d48' : '#0d9488'}; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);">
              <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Vaccination Status Details</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500; width: 35%;">Patient Name:</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">\${petName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Vaccine Required:</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">\${vaccine}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Status:</td>
                  <td style="padding: 8px 0; font-weight: 800; color: \${new Date(dueDate) < new Date() ? '#e11d48' : '#0d9488'};">\${new Date(dueDate) < new Date() ? 'OVERDUE' : 'UPCOMING / DUE'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 500;">Due Date:</td>
                  <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">\${new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
              Maintaining an up-to-date vaccination schedule is highly critical to ensuring <strong>\${petName}</strong> remains protected against severe and potentially fatal diseases. \${new Date(dueDate) < new Date() ? 'Delaying this vaccination could compromise their immune system and put their health at significant risk.' : 'Please schedule an appointment at your earliest convenience.'}
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="\${process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000'}" style="display: inline-block; padding: 14px 28px; background: \${new Date(dueDate) < new Date() ? '#e11d48' : '#0d9488'}; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); transition: all 0.2s ease;">
                Schedule Appointment Now
              </a>
            </div>

            <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">
              If you have already administered this vaccine at another facility, please contact us at <strong>\${clinic?.contact?.phone || 'our clinic'}</strong> or reply to this email with the updated medical certificate so we can update our records.
            </p>
          </div>
          
          <div style="background: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 13px; color: #475569; font-weight: 600;">\${clinic ? clinic.name : 'PawChart Veterinary Center'}</p>
            \${clinic ? \`<p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">\${clinic.address?.street || ''}, \${clinic.address?.city || ''}</p>\` : ''}
            <p style="margin: 16px 0 0 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">
              Powered by PawChart Medical Systems
            </p>
          </div>
        </div>
      \``;

if (!regex.test(content)) {
    console.log("Could not find the pattern to replace!");
} else {
    content = content.replace(regex, '$1' + newHtml + '$2');
    fs.writeFileSync(file, content, 'utf8');
    console.log("Replaced email template successfully!");
}
