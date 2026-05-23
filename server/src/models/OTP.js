import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phone: {
    type: String,
    default: ''
  },
  otp: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['signup', 'login', 'super_admin_registration', 'clinic_admin_setup'],
    required: true
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000)
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 600 }
  }
});

const OTP = mongoose.model('OTP', otpSchema);
export default OTP;
