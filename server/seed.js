import mongoose from 'mongoose';
import { Vet, Client, Appointment, Vaccination, FollowUp, WeightLog } from './src/models.js';
import Clinic from './src/models/Clinic.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

async function seed() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    console.error('❌ DANGER: Cannot run seed script in production environment!');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // Clear existing data (optional, let's just clear Vets, Clients, Clinics for a fresh start)
    console.log('Clearing old test data...');
    await Clinic.deleteMany({ name: { $in: ['APOLLO Clinic', 'Downtown Animal Hospital'] }});
    await Vet.deleteMany({ name: { $in: ['Dr. Shekhar', 'Dr. Sarah Jenkins', 'Dr. Marcus Thorne'] }});
    await Client.deleteMany({ name: { $in: ['John Doe', 'Jane Smith', 'Alice Cooper'] }});
    
    console.log('Seeding Clinics...');
    const clinic1 = await Clinic.create({
      name: 'APOLLO Clinic',
      status: 'active',
      registration_number: 'REG-APOLLO-' + Date.now(),
      contact: { phone: '555-0101', email: 'apollo@clinic.com' },
      address: { street: '123 Apollo Way', city: 'Metropolis', state: 'NY', postal_code: '10001' }
    });

    const clinic2 = await Clinic.create({
      name: 'Downtown Animal Hospital',
      status: 'active',
      registration_number: 'REG-DOWNTOWN-' + Date.now(),
      contact: { phone: '555-0202', email: 'downtown@clinic.com' },
      address: { street: '456 Downtown Blvd', city: 'Metropolis', state: 'NY', postal_code: '10002' }
    });

    console.log('Seeding Vets...');
    const vet1 = await Vet.create({
      clinic_id: clinic1._id,
      name: 'Dr. Shekhar',
      specialty: 'General Practice',
      email: 'shekhar@apollo.com',
      phone: '555-1111',
      status: 'Active'
    });

    const vet2 = await Vet.create({
      clinic_id: clinic1._id,
      name: 'Dr. Sarah Jenkins',
      specialty: 'Surgery',
      email: 'sarah@apollo.com',
      phone: '555-2222',
      status: 'Active'
    });

    const vet3 = await Vet.create({
      clinic_id: clinic2._id,
      name: 'Dr. Marcus Thorne',
      specialty: 'Dermatology',
      email: 'marcus@downtown.com',
      phone: '555-3333',
      status: 'Active'
    });

    console.log('Seeding Clients & Pets...');
    const client1 = await Client.create({
      clinic_id: clinic1._id,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-4444',
      status: 'Active',
      pets: [
        { name: 'Buddy', species: 'Dog', breed: 'Golden Retriever', age: '4 yrs', sex: 'Male', petId: 'PET-001', emoji: '🐕' },
        { name: 'Luna', species: 'Cat', breed: 'Siamese', age: '2 yrs', sex: 'Female', petId: 'PET-002', emoji: '🐈' }
      ]
    });

    const client2 = await Client.create({
      clinic_id: clinic1._id,
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '555-5555',
      status: 'Active',
      pets: [
        { name: 'Max', species: 'Dog', breed: 'German Shepherd', age: '5 yrs', sex: 'Male', petId: 'PET-003', emoji: '🐕' }
      ]
    });

    const client3 = await Client.create({
      clinic_id: clinic2._id,
      name: 'Alice Cooper',
      email: 'alice@example.com',
      phone: '555-6666',
      status: 'Active',
      pets: [
        { name: 'Polly', species: 'Bird', breed: 'Parrot', age: '1 yr', sex: 'Female', petId: 'PET-004', emoji: '🦜' }
      ]
    });

    console.log('Seeding Appointments...');
    await Appointment.create({
      clinic_id: clinic1._id,
      clientId: client1._id,
      petId: client1.pets[0]._id,
      vetId: vet1._id,
      petName: 'Buddy',
      ownerName: 'John Doe',
      vetName: 'Dr. Shekhar',
      date: new Date().toISOString().split('T')[0],
      time: '10:00 AM',
      type: 'Checkup',
      reason: 'Routine checkup',
      status: 'Scheduled',
      duration: '30 mins'
    });

    await Appointment.create({
      clinic_id: clinic1._id,
      clientId: client1._id,
      petId: client1.pets[1]._id,
      vetId: vet1._id,
      petName: 'Luna',
      ownerName: 'John Doe',
      vetName: 'Dr. Shekhar',
      date: new Date().toISOString().split('T')[0],
      time: '11:00 AM',
      type: 'Vaccination',
      reason: 'Annual boosters',
      status: 'Scheduled',
      duration: '30 mins'
    });

    await Appointment.create({
      clinic_id: clinic1._id,
      clientId: client2._id,
      petId: client2.pets[0]._id,
      vetId: vet2._id,
      petName: 'Max',
      ownerName: 'Jane Smith',
      vetName: 'Dr. Sarah Jenkins',
      date: new Date().toISOString().split('T')[0],
      time: '14:00 PM',
      type: 'Surgery Check',
      reason: 'Post-op review',
      status: 'Scheduled',
      duration: '60 mins'
    });

    await Appointment.create({
      clinic_id: clinic2._id,
      clientId: client3._id,
      petId: client3.pets[0]._id,
      vetId: vet3._id,
      petName: 'Polly',
      ownerName: 'Alice Cooper',
      vetName: 'Dr. Marcus Thorne',
      date: new Date().toISOString().split('T')[0],
      time: '09:00 AM',
      type: 'General Consult',
      reason: 'Feather plucking',
      status: 'Scheduled',
      duration: '30 mins'
    });

    console.log('Seeding Weight Logs & Follow-ups...');
    await WeightLog.create({
      clinic_id: clinic1._id,
      petName: 'Buddy',
      ownerName: 'John Doe',
      value: 32.4,
      unit: 'lbs',
      date: new Date().toISOString().split('T')[0],
      note: 'Healthy weight'
    });

    await FollowUp.create({
      clinic_id: clinic1._id,
      petName: 'Buddy',
      ownerName: 'John Doe',
      vetName: 'Dr. Shekhar',
      reason: 'Post-checkup review',
      date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // 7 days from now
      status: 'Pending'
    });

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding DB:', err);
    process.exit(1);
  }
}

seed();
