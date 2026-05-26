import { Client } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';

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

export const addPet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const filter = { _id: id, ...getQueryFilter(req) };
    const client = await Client.findOne(filter);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    client.pets.push(req.body);
    await client.save();
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

    client.pets.pull(petId);
    await client.save();
    res.json(client);
  } catch (error) {
    next(error);
  }
};
