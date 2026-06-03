import 'dotenv/config';
import { connectDb } from './db.js';
import { Appointment, Client, FollowUp, SoapNote, Vaccination, Vet, WeightLog } from './models.js';
import Clinic from './models/Clinic.js';
import { seedData } from './data.js';

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

async function seed() {
  try {
    await connectDb(mongoUri);
    console.log("Connected successfully to MongoDB for seeding.");

    // 1. Find or create clinics to preserve IDs
    let crownClinic = await Clinic.findOne({ name: 'Crown Vet' });
    if (!crownClinic) {
      crownClinic = await Clinic.create({
        name: 'Crown Vet',
        status: 'active',
        registration_number: 'REG-CROWN-' + Date.now(),
        contact: { phone: '555-0001', email: 'crown@clinic.com' },
        address: { street: '123 Crown Rd', city: 'Metropolis', state: 'NY', postal_code: '10000' }
      });
    }

    let apolloClinic = await Clinic.findOne({ name: 'APOLLO Clinic' });
    if (!apolloClinic) {
      apolloClinic = await Clinic.create({
        name: 'APOLLO Clinic',
        status: 'active',
        registration_number: 'REG-APOLLO-' + Date.now(),
        contact: { phone: '555-0101', email: 'apollo@clinic.com' },
        address: { street: '123 Apollo Way', city: 'Metropolis', state: 'NY', postal_code: '10001' }
      });
    }

    let downtownClinic = await Clinic.findOne({ name: 'Downtown Animal Hospital' });
    if (!downtownClinic) {
      downtownClinic = await Clinic.create({
        name: 'Downtown Animal Hospital',
        status: 'active',
        registration_number: 'REG-DOWNTOWN-' + Date.now(),
        contact: { phone: '555-0202', email: 'downtown@clinic.com' },
        address: { street: '456 Downtown Blvd', city: 'Metropolis', state: 'NY', postal_code: '10002' }
      });
    }

    console.log(`Using Clinics:`);
    console.log(` - Crown Vet: ${crownClinic._id}`);
    console.log(` - APOLLO Clinic: ${apolloClinic._id}`);
    console.log(` - Downtown Animal Hospital: ${downtownClinic._id}`);

    // 2. Clear old data
    console.log("Clearing existing data (except clinics)...");
    await Promise.all([
      Vet.deleteMany({}),
      Client.deleteMany({}),
      Appointment.deleteMany({}),
      Vaccination.deleteMany({}),
      FollowUp.deleteMany({}),
      WeightLog.deleteMany({}),
      SoapNote.deleteMany({})
    ]);

    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${date}`;

    const tom = new Date(d);
    tom.setDate(d.getDate() + 1);
    const tomYear = tom.getFullYear();
    const tomMonth = String(tom.getMonth() + 1).padStart(2, '0');
    const tomDate = String(tom.getDate()).padStart(2, '0');
    const tomorrowStr = `${tomYear}-${tomMonth}-${tomDate}`;

    // --- SEED DATA FOR CROWN VET (using seedData) ---
    console.log("Seeding data for Crown Vet...");
    
    // Vets
    const crownVetsWithClinic = seedData.vets.map(v => ({ ...v, clinic_id: crownClinic._id }));
    const insertedCrownVets = await Vet.insertMany(crownVetsWithClinic);
    const crownVetMap = {};
    insertedCrownVets.forEach(v => {
      crownVetMap[v.name.toLowerCase()] = v._id;
    });

    // Clients & Pets
    const crownClientsWithClinic = seedData.clients.map(c => ({ ...c, clinic_id: crownClinic._id }));
    const insertedCrownClients = await Client.insertMany(crownClientsWithClinic);
    const crownClientMap = {};
    const crownPetMap = {};
    insertedCrownClients.forEach(cl => {
      crownClientMap[cl.name.toLowerCase()] = cl._id;
      if (cl.pets) {
        cl.pets.forEach(p => {
          crownPetMap[`${cl.name.toLowerCase()}_${p.name.toLowerCase()}`] = p._id;
        });
      }
    });

    // Appointments
    const crownAppointments = seedData.appointments.map(appt => {
      let newDate = appt.date;
      if (appt.date === '2026-05-22') {
        newDate = todayStr;
      } else if (appt.date === '2026-05-23') {
        newDate = tomorrowStr;
      }
      
      const ownerKey = appt.ownerName?.toLowerCase();
      const petKey = `${ownerKey}_${appt.petName?.toLowerCase()}`;
      const vetKey = appt.vetName?.toLowerCase();

      return {
        ...appt,
        date: newDate,
        clinic_id: crownClinic._id,
        clientId: crownClientMap[ownerKey],
        petId: crownPetMap[petKey],
        vetId: crownVetMap[vetKey]
      };
    });

    // Vaccinations
    const crownVaccinations = seedData.vaccinations.map(vax => {
      const ownerKey = vax.ownerName?.toLowerCase();
      const petKey = `${ownerKey}_${vax.petName?.toLowerCase()}`;
      return {
        ...vax,
        clinic_id: crownClinic._id,
        clientId: crownClientMap[ownerKey],
        petId: crownPetMap[petKey]
      };
    });

    // Follow-ups
    const crownFollowUps = seedData.followUps.map(f => {
      const ownerKey = f.ownerName?.toLowerCase();
      const petKey = `${ownerKey}_${f.petName?.toLowerCase()}`;
      
      let matchedVetId = null;
      if (f.vetName) {
        const lowerVetName = f.vetName.toLowerCase();
        for (const [name, id] of Object.entries(crownVetMap)) {
          if (name.includes(lowerVetName) || lowerVetName.includes(name) || name.replace('dr. ', '').includes(lowerVetName.replace('dr. ', ''))) {
            matchedVetId = id;
            break;
          }
        }
      }

      return {
        ...f,
        clinic_id: crownClinic._id,
        clientId: crownClientMap[ownerKey],
        petId: crownPetMap[petKey],
        vetId: matchedVetId
      };
    });

    // Weights
    const crownWeights = seedData.weights.map(w => {
      const ownerKey = w.ownerName?.toLowerCase();
      const petKey = `${ownerKey}_${w.petName?.toLowerCase()}`;
      return {
        ...w,
        clinic_id: crownClinic._id,
        clientId: crownClientMap[ownerKey],
        petId: crownPetMap[petKey]
      };
    });

    // SOAP Notes
    const crownSoapNotes = seedData.soapNotes.map(s => {
      const ownerKey = s.ownerName?.toLowerCase();
      const petKey = `${ownerKey}_${s.petName?.toLowerCase()}`;
      const vetKey = s.vetName?.toLowerCase();
      return {
        ...s,
        clinic_id: crownClinic._id,
        clientId: crownClientMap[ownerKey],
        petId: crownPetMap[petKey],
        vetId: crownVetMap[vetKey]
      };
    });

    await Promise.all([
      Appointment.insertMany(crownAppointments),
      Vaccination.insertMany(crownVaccinations),
      FollowUp.insertMany(crownFollowUps),
      WeightLog.insertMany(crownWeights),
      SoapNote.insertMany(crownSoapNotes)
    ]);
    console.log("Crown Vet data seeded successfully.");


    // --- SEED DATA FOR APOLLO & DOWNTOWN CLINICS (from server/seed.js) ---
    console.log("Seeding data for APOLLO Clinic and Downtown Animal Hospital...");

    // Vets
    const apolloVets = [
      { name: 'Dr. Shekhar', specialty: 'General Practice', email: 'shekhar@apollo.com', phone: '555-1111', status: 'Active', clinic_id: apolloClinic._id },
      { name: 'Dr. Sarah Jenkins', specialty: 'Surgery', email: 'sarah@apollo.com', phone: '555-2222', status: 'Active', clinic_id: apolloClinic._id }
    ];
    const downtownVets = [
      { name: 'Dr. Marcus Thorne', specialty: 'Dermatology', email: 'marcus@downtown.com', phone: '555-3333', status: 'Active', clinic_id: downtownClinic._id }
    ];
    const insertedVets = await Vet.insertMany([...apolloVets, ...downtownVets]);
    const vetMap = {};
    insertedVets.forEach(v => {
      vetMap[v.name.toLowerCase()] = v._id;
    });

    // Clients & Pets
    const apolloClients = [
      {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-4444',
        status: 'Active',
        clinic_id: apolloClinic._id,
        pets: [
          { name: 'Buddy', species: 'Dog', breed: 'Golden Retriever', age: '4 yrs', sex: 'Male', petId: 'PET-001', emoji: '🐕' },
          { name: 'Luna', species: 'Cat', breed: 'Siamese', age: '2 yrs', sex: 'Female', petId: 'PET-002', emoji: '🐈' }
        ]
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-5555',
        status: 'Active',
        clinic_id: apolloClinic._id,
        pets: [
          { name: 'Max', species: 'Dog', breed: 'German Shepherd', age: '5 yrs', sex: 'Male', petId: 'PET-003', emoji: '🐕' }
        ]
      }
    ];

    const downtownClients = [
      {
        name: 'Alice Cooper',
        email: 'alice@example.com',
        phone: '555-6666',
        status: 'Active',
        clinic_id: downtownClinic._id,
        pets: [
          { name: 'Polly', species: 'Bird', breed: 'Parrot', age: '1 yr', sex: 'Female', petId: 'PET-004', emoji: '🦜' }
        ]
      }
    ];

    const insertedClients = await Client.insertMany([...apolloClients, ...downtownClients]);
    const clientMap = {};
    const petMap = {};
    insertedClients.forEach(cl => {
      clientMap[cl.name.toLowerCase()] = cl._id;
      if (cl.pets) {
        cl.pets.forEach(p => {
          petMap[`${cl.name.toLowerCase()}_${p.name.toLowerCase()}`] = p._id;
        });
      }
    });

    // Appointments
    const apolloAppointments = [
      {
        petName: 'Buddy',
        ownerName: 'John Doe',
        vetName: 'Dr. Shekhar',
        date: todayStr,
        time: '10:00 AM',
        type: 'Checkup',
        reason: 'Routine checkup',
        status: 'Scheduled',
        duration: '30 mins',
        clinic_id: apolloClinic._id
      },
      {
        petName: 'Luna',
        ownerName: 'John Doe',
        vetName: 'Dr. Shekhar',
        date: todayStr,
        time: '11:00 AM',
        type: 'Vaccination',
        reason: 'Annual boosters',
        status: 'Scheduled',
        duration: '30 mins',
        clinic_id: apolloClinic._id
      },
      {
        petName: 'Max',
        ownerName: 'Jane Smith',
        vetName: 'Dr. Sarah Jenkins',
        date: todayStr,
        time: '14:00 PM',
        type: 'Surgery Check',
        reason: 'Post-op review',
        status: 'Scheduled',
        duration: '60 mins',
        clinic_id: apolloClinic._id
      }
    ];

    const downtownAppointments = [
      {
        petName: 'Polly',
        ownerName: 'Alice Cooper',
        vetName: 'Dr. Marcus Thorne',
        date: todayStr,
        time: '09:00 AM',
        type: 'General Consult',
        reason: 'Feather plucking',
        status: 'Scheduled',
        duration: '30 mins',
        clinic_id: downtownClinic._id
      }
    ];

    const allApptsMapped = [...apolloAppointments, ...downtownAppointments].map(appt => {
      const ownerKey = appt.ownerName?.toLowerCase();
      const petKey = `${ownerKey}_${appt.petName?.toLowerCase()}`;
      const vetKey = appt.vetName?.toLowerCase();
      return {
        ...appt,
        clientId: clientMap[ownerKey],
        petId: petMap[petKey],
        vetId: vetMap[vetKey]
      };
    });

    // Follow-ups
    const apolloFollowUps = [
      {
        petName: 'Buddy',
        ownerName: 'John Doe',
        vetName: 'Dr. Shekhar',
        reason: 'Post-checkup review',
        date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
        status: 'Pending',
        clinic_id: apolloClinic._id
      }
    ].map(f => {
      const ownerKey = f.ownerName?.toLowerCase();
      const petKey = `${ownerKey}_${f.petName?.toLowerCase()}`;
      const vetKey = f.vetName?.toLowerCase();
      return {
        ...f,
        clientId: clientMap[ownerKey],
        petId: petMap[petKey],
        vetId: vetMap[vetKey]
      };
    });

    // Weights
    const apolloWeights = [
      {
        petName: 'Buddy',
        ownerName: 'John Doe',
        value: 32.4,
        unit: 'lbs',
        date: todayStr,
        note: 'Healthy weight',
        clinic_id: apolloClinic._id
      }
    ].map(w => {
      const ownerKey = w.ownerName?.toLowerCase();
      const petKey = `${ownerKey}_${w.petName?.toLowerCase()}`;
      return {
        ...w,
        clientId: clientMap[ownerKey],
        petId: petMap[petKey]
      };
    });

    await Promise.all([
      Appointment.insertMany(allApptsMapped),
      FollowUp.insertMany(apolloFollowUps),
      WeightLog.insertMany(apolloWeights)
    ]);
    console.log("APOLLO Clinic and Downtown Animal Hospital data seeded successfully.");

    console.log('\n✅ Successfully Seeded both Crown Vet and APOLLO/Downtown datasets separated by clinic.');
    process.exit(0);

  } catch (err) {
    console.error("Error during seeding:", err);
    process.exit(1);
  }
}

seed();
