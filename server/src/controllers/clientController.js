import { Client, Vaccination, VaccineMaster, PetCounter } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';
import { calculateDueDate } from '../utils/dateCalculator.js';
import { generateVaccinesForPets } from '../utils/vaccineGenerator.js';
import mongoose from 'mongoose';

export async function generatePetId(clinicId, species) {
  let speciesCode = "UNK";
  if (species) {
    speciesCode = species.trim().substring(0, 3).toUpperCase();
  }
  
  const safeClinicId = clinicId ? clinicId : "000000000000000000000000";
  const clinicObjectId = safeClinicId instanceof mongoose.Types.ObjectId
    ? safeClinicId
    : new mongoose.Types.ObjectId(safeClinicId);

  let petId;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    const counter = await PetCounter.findOneAndUpdate(
      {
        clinic_id: clinicObjectId,
        species_code: speciesCode,
      },
      {
        $inc: { sequence: 1 },
        $setOnInsert: {
          clinic_id: clinicObjectId,
          species_code: speciesCode
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    petId = `PET-${speciesCode}-${String(counter.sequence).padStart(4, "0")}`;
    
    // Safety check against existing Client.pets.petId within the same clinic
    exists = await Client.exists({ clinic_id: clinicObjectId, "pets.petId": petId });
    attempts++;
  }

  return petId || `PET-${speciesCode}-${Date.now().toString().slice(-4)}`;
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

    if (body.pets && Array.isArray(body.pets)) {
      for (const pet of body.pets) {
        pet.petId = await generatePetId(body.clinic_id, pet.species);
      }
    }

    const created = await Client.create(body);
    
    // Auto-generate vaccination plan for initial pets
    if (created.pets && created.pets.length > 0) {
      await generateVaccinesForPets(created.pets, created.name, created.clinic_id, created._id);
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

    const petData = { ...req.body };
    petData.petId = await generatePetId(client.clinic_id, petData.species);

    client.pets.push(petData);
    await client.save();
    
    // Auto-generate vaccination plan
    const newPet = client.pets[client.pets.length - 1]; // get the newly added pet with its generated _id
    if (newPet.dateOfBirth && newPet.species) {
      await generateVaccinesForPets([client.pets[client.pets.length - 1]], client.name, client.clinic_id, client._id);
    }
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

    // Do NOT allow overwriting petId from the frontend
    if (req.body.petId) {
      delete req.body.petId;
    }

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
        if (models.WeightLog) await models.WeightLog.deleteMany({ petName: pet.name, ownerName: client.name, clinic_id: client.clinic_id });
        if (models.SoapNote) await models.SoapNote.deleteMany({ petName: pet.name, ownerName: client.name, clinic_id: client.clinic_id });
    }

    client.pets.pull(petId);
    await client.save();
    res.json(client);
  } catch (error) {
    next(error);
  }
};

export const updateClient = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...getQueryFilter(req) };
    const oldClient = await Client.findOne(filter);
    if (!oldClient) return res.status(404).json({ message: 'Client not found' });

    // Track name changes
    const clientNameChanged = req.body.name && req.body.name !== oldClient.name;
    const petNameChanges = [];
    const newlyAddedPets = [];

    if (req.body.pets && Array.isArray(req.body.pets)) {
      for (const newPet of req.body.pets) {
        if (!newPet._id) {
          newlyAddedPets.push(newPet);
          continue;
        }
        const oldPet = oldClient.pets.id(newPet._id);
        if (oldPet && newPet.name && newPet.name !== oldPet.name) {
          petNameChanges.push({ oldName: oldPet.name, newName: newPet.name });
        }
      }
    }

    const updated = await Client.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });

    // Auto-generate vaccines for newly added pets
    if (newlyAddedPets.length > 0) {
      const oldPetIds = oldClient.pets.map(p => p._id.toString());
      const newPetsWithIds = updated.pets.filter(p => !oldPetIds.includes(p._id.toString()));
      if (newPetsWithIds.length > 0) {
         await generateVaccinesForPets(newPetsWithIds, updated.name, updated.clinic_id, updated._id);
      }
    }

    // Cascade name updates
    const { default: mongoose } = await import('mongoose');
    const models = mongoose.models;

    if (clientNameChanged) {
        const cascadeQuery = { ownerName: oldClient.name, clinic_id: oldClient.clinic_id };
        const updateData = { ownerName: updated.name };
        if (models.Appointment) await models.Appointment.updateMany(cascadeQuery, updateData);
        if (models.Vaccination) await models.Vaccination.updateMany(cascadeQuery, updateData);
        if (models.FollowUp) await models.FollowUp.updateMany(cascadeQuery, updateData);
        if (models.WeightLog) await models.WeightLog.updateMany(cascadeQuery, updateData);
        if (models.SoapNote) await models.SoapNote.updateMany(cascadeQuery, updateData);
    }

    for (const change of petNameChanges) {
        const cascadeQuery = { petName: change.oldName, ownerName: updated.name, clinic_id: oldClient.clinic_id };
        const updateData = { petName: change.newName };
        if (models.Appointment) await models.Appointment.updateMany(cascadeQuery, updateData);
        if (models.Vaccination) await models.Vaccination.updateMany(cascadeQuery, updateData);
        if (models.FollowUp) await models.FollowUp.updateMany(cascadeQuery, updateData);
        if (models.WeightLog) await models.WeightLog.updateMany(cascadeQuery, updateData);
        if (models.SoapNote) await models.SoapNote.updateMany(cascadeQuery, updateData);
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
