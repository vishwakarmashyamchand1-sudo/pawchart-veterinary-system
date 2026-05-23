import { Vet, Client, Appointment, Vaccination, FollowUp, WeightLog, SoapNote } from '../models.js';
import { getQueryFilter } from '../middleware/auth.js';

const models = {
  vets: Vet,
  clients: Client,
  appointments: Appointment,
  vaccinations: Vaccination,
  followups: FollowUp,
  weights: WeightLog,
  soapnotes: SoapNote
};

export const getResource = async (req, res, next) => {
  try {
    const { resource } = req.params;
    const Model = models[resource];
    if (!Model) return res.status(404).json({ message: `Resource ${resource} not found` });

    const filter = getQueryFilter(req);
    res.json(await Model.find(filter).sort({ createdAt: -1 }).lean());
  } catch (error) {
    next(error);
  }
};

export const createResource = async (req, res, next) => {
  try {
    const { resource } = req.params;
    const Model = models[resource];
    if (!Model) return res.status(404).json({ message: `Resource ${resource} not found` });

    const body = { ...req.body };
    const clinicId = req.header('x-clinic-id') || req.query.clinic_id || (req.user && req.user.clinicId);
    if (clinicId) {
      body.clinic_id = clinicId;
    }
    const created = await Model.create(body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
};

export const updateResource = async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    const Model = models[resource];
    if (!Model) return res.status(404).json({ message: `Resource ${resource} not found` });

    const updated = await Model.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: `${resource} record not found` });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteResource = async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    const Model = models[resource];
    if (!Model) return res.status(404).json({ message: `Resource ${resource} not found` });

    const deleted = await Model.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: `${resource} record not found` });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
