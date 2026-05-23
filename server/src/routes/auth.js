import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import OTP from '../models/OTP.js';
import { generateOTP, sendEmailOTP } from '../utils/otpService.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'pawchart-secret-key';

/**
 * @openapi
 * /api/auth/send-otp:
 *   post:
 *     summary: Request email OTP verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - type
 *             properties:
 *               email:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [signup, login]
 *     responses:
 *       200:
 *         description: OTP transmitted successfully
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { email, type } = req.body;

    if (!email || !type) {
      return res.status(400).json({ message: 'Email and type are required' });
    }

    if (!['signup', 'login'].includes(type)) {
      return res.status(400).json({ message: 'Type must be signup or login' });
    }

    const user = await User.findOne({ email });

    if (type === 'signup' && user) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    if (type === 'login' && !user) {
      // For simple and stable demo login: if user isn't found, auto-create as owner so users never get stuck!
      console.log(`💡 Demo Auto-Onboarding: Creating default account for ${email}`);
      const namePart = email.split('@')[0];
      const randomPhone = '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
      await User.create({
        name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
        email,
        phone: randomPhone,
        role: 'owner',
        isVerified: true
      });
    }

    const otp = generateOTP();
    await OTP.deleteMany({ email });
    await OTP.create({ email, phone: '', otp, type });

    const emailResult = await sendEmailOTP(email, otp);

    res.json({
      message: 'OTP sent successfully to your email',
      success: true,
      simulated: !!emailResult.simulated,
      otp: process.env.NODE_ENV !== 'production' || emailResult.simulated ? otp : undefined
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @openapi
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify email OTP and authenticate session
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification successful, session token generated
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: 'OTP has expired' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Associated account not found' });
    }

    await OTP.deleteOne({ _id: otpRecord._id });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        clinic_id: user.clinic_id || null
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @openapi
 * /api/auth/register-super-admin:
 *   post:
 *     summary: Register the primary Super Admin profile
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - phone
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Super Admin registered successfully
 */
router.post('/register-super-admin', async (req, res) => {
  try {
    const { email, phone, name } = req.body;

    if (!email || !phone || !name) {
      return res.status(400).json({ message: 'Email, phone, and name are required' });
    }

    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) {
      return res.status(400).json({
        message: 'Super Admin already exists in the system.'
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      role: 'super_admin',
      isVerified: true
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Super Admin registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register super admin error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Retrieve details of current logged in user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile details loaded
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      clinic_id: user.clinic_id || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;
