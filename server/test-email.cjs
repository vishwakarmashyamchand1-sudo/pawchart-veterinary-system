require('dotenv').config();
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = process.env.SMTP_PORT || 587;
const user = process.env.SMTP_USER || process.env.EMAIL_USER;
const pass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;

console.log('Using SMTP:', host, port, user, 'PASS LENGTH:', pass ? pass.length : 0);

async function testMail() {
    try {
        let transporter = nodemailer.createTransport({
            host: host,
            port: parseInt(port),
            secure: parseInt(port) === 465,
            auth: {
                user: user,
                pass: pass
            }
        });
        
        console.log("Verifying connection...");
        await transporter.verify();
        console.log("Verification successful!");
        
        let info = await transporter.sendMail({
            from: process.env.SMTP_FROM || user,
            to: user, // Send to self
            subject: "Test Mail",
            text: "This is a test email"
        });
        
        console.log("Message sent: %s", info.messageId);
    } catch(err) {
        console.error("Error:", err);
    }
}

testMail();
