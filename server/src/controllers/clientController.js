import { Client, Vaccination, VaccineMaster } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';
import { calculateDueDate } from '../utils/dateCalculator.js';

async function generateVaccinesForPets(pets, clientName, clinicId) {
  const newVaccinations = [];
  for (const pet of pets) {
    if (pet.dateOfBirth && pet.species) {
      const masterVaccines = await VaccineMaster.find({ 
        species: { $regex: new RegExp(`^${pet.species}$`, 'i') } 
      });
      for (const mv of masterVaccines) {
        const dueDate = calculateDueDate(pet.dateOfBirth, mv.recommendedAge);
        if (dueDate) {
          newVaccinations.push({
            petName: pet.name,
            ownerName: clientName,
            breed: pet.breed,
            vaccine: mv.name,
            dueDate: dueDate,
            status: 'Pending',
            clinic_id: clinicId
          });
        }
      }
    }
  }
  if (newVaccinations.length > 0) {
    await Vaccination.insertMany(newVaccinations);
  }
}


export const searchClients = async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = getQueryFilter(req);
    
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { "pets.name": { $regex: q, $options: 'i' } }
      ];
    }
    
    const clients = await Client.find(filter).sort({ createdAt: -1 }).lean();
    res.json(clients);
  } catch (error) {
    next(error);
  }
};

export const createClient = async (req, res, next) => {
  try {
    const body = { ...req.body };
    const clinicId = req.header('x-clinic-id') || req.query.clinic_id || (req.user && req.user.clinicId);
    if (clinicId) { body.clinic_id = clinicId; }

    if (body.email) {
      const existing = await Client.findOne({ email: body.email });
      if (existing) return res.status(400).json({ message: `The email '${body.email}' is already registered. Please use a unique value.` });
    }
    if (body.phone) {
      const existing = await Client.findOne({ phone: body.phone });
      if (existing) return res.status(400).json({ message: `The phone '${body.phone}' is already registered. Please use a unique value.` });
    }

    const created = await Client.create(body);
    
    // Auto-generate vaccination plan for initial pets
    if (created.pets && created.pets.length > 0) {
      await generateVaccinesForPets(created.pets, created.name, created.clinic_id);
    }

    res.status(201).json(created);
  } catch (error) { next(error); }
};

export const addPet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filter = { _id: id, ...getQueryFilter(req) };
    const client = await Client.findOne(filter);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    client.pets.push(req.body);
    await client.save();
    
    // Auto-generate vaccination plan
    const newPet = client.pets[client.pets.length - 1]; // get the newly added pet with its generated _id
    await generateVaccinesForPets([newPet], client.name, client.clinic_id);

    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
};

export const updatePet = async (req, res, next) => {
  try {
    const { id, petId } = req.params;
    const filter = { _id: id, ...getQueryFilter(req) };
    const client = await Client.findOne(filter);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const pet = client.pets.id(petId);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });

    pet.set(req.body);
    await client.save();
    res.json(client);
  } catch (error) {
    next(error);
  }
};

export const deletePet = async (req, res, next) => {
  try {
    const { id, petId } = req.params;
    const filter = { _id: id, ...getQueryFilter(req) };
    const client = await Client.findOne(filter);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const pet = client.pets.id(petId);
    if (pet) {
        const { default: mongoose } = await import('mongoose');
        const models = mongoose.models;
        const cascadeQuery = { petName: pet.name, ownerName: client.name, clinic_id: client.clinic_id };
        if (models.Appointment) await models.Appointment.deleteMany(cascadeQuery);
        if (models.Vaccination) await models.Vaccination.deleteMany(cascadeQuery);
        if (models.FollowUp) await models.FollowUp.deleteMany(cascadeQuery);
    }

    client.pets.pull(petId);
    await client.save();
    res.json(client);
  } catch (error) {
    next(error);
  }
};
