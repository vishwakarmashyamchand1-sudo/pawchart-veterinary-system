import mongoose from 'mongoose';

const clinicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Clinic name is required'],
    trim: true
  },
  registration_number: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postal_code: { type: String, required: true },
    country: { type: String, default: 'India' }
  },
  contact: {
    phone: {
      type: String,
      required: [true, 'Phone number is required']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'temporarily_closed'],
    default: 'active'
  },
  specialties: {
    type: String,
    default: 'General Practice, Vaccines, Surgery'
  }
}, {
  timestamps: true
});

// Indexes for query speed
clinicSchema.index({ name: 1 });
clinicSchema.index({ status: 1 });
// `registration_number` already has `unique: true` on the field definition.
// Removing the explicit schema index to avoid duplicate index warnings.
const Clinic = mongoose.model('Clinic', clinicSchema);
export default Clinic;
