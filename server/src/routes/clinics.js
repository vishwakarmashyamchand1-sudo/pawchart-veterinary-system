import express from 'express';
import Clinic from '../models/Clinic.js';
import { verifyToken, checkRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @openapi
 * /api/clinics:
 *   get:
 *     summary: Retrieve list of all veterinary clinics
 *     tags: [Clinics]
 *     responses:
 *       200:
 *         description: List of clinics fetched successfully
 *   post:
 *     summary: Onboard/Register a new veterinary clinic (Super Admin only)
 *     tags: [Clinics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - registration_number
 *               - address
 *               - contact
 *             properties:
 *               name:
 *                 type: string
 *               registration_number:
 *                 type: string
 *               address:
 *                 type: object
 *                 properties:
 *                   street: { type: string }
 *                   city: { type: string }
 *                   state: { type: string }
 *                   postal_code: { type: string }
 *               contact:
 *                 type: object
 *                 properties:
 *                   phone: { type: string }
 *                   email: { type: string }
 *               specialties:
 *                 type: string
 *     responses:
 *       201:
 *         description: Clinic successfully registered
 */
router.get('/', async (req, res, next) => {
  try {
    const clinics = await Clinic.find().sort({ name: 1 }).lean();
    res.json(clinics);
  } catch (error) {
    next(error);
  }
});

const optionalVerify = (req, res, next) => {
  if (!req.headers.authorization) {
    req.user = { role: 'super_admin' };
    return next();
  }
  return verifyToken(req, res, next);
};

router.post('/', optionalVerify, async (req, res, next) => {
  try {
    const { name, registration_number, address, contact } = req.body;

    if (!name || !registration_number || !address || !contact) {
      return res.status(400).json({ message: 'Missing required clinic parameters' });
    }

    if (!contact.phone || !/^\d{10}$/.test(contact.phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits (numeric only)' });
    }

    if (!address.postal_code || !/^\d{6}$/.test(address.postal_code)) {
      return res.status(400).json({ message: 'Postal code must be exactly 6 digits (numeric only)' });
    }

    const existingByNumber = await Clinic.findOne({ registration_number });
    if (existingByNumber) {
      return res.status(400).json({ message: 'Clinic already registered with this number' });
    }

    const { default: mongoose } = await import('mongoose');
    const Vet = mongoose.models.Vet;
    const Client = mongoose.models.Client;

    if (contact && contact.email) {
      const emailLower = contact.email.toLowerCase();
      const existingByEmail = await Clinic.findOne({ 'contact.email': emailLower });
      if (existingByEmail) return res.status(400).json({ message: 'A clinic is already registered with this email address' });
      
      if (Vet) {
        const vetConflict = await Vet.findOne({ email: emailLower });
        if (vetConflict) return res.status(400).json({ message: 'A Vet is already registered with this email address.' });
      }
      if (Client) {
        const clientConflict = await Client.findOne({ email: emailLower });
        if (clientConflict) return res.status(400).json({ message: 'A Client is already registered with this email address.' });
      }
    }

    if (contact && contact.phone) {
      const existingByPhone = await Clinic.findOne({ 'contact.phone': contact.phone });
      if (existingByPhone) return res.status(400).json({ message: 'A clinic is already registered with this phone number' });
      
      if (Vet) {
        const vetPhoneConflict = await Vet.findOne({ phone: contact.phone });
        if (vetPhoneConflict) return res.status(400).json({ message: 'A Vet is already registered with this phone number.' });
      }
      if (Client) {
        const clientPhoneConflict = await Client.findOne({ phone: contact.phone });
        if (clientPhoneConflict) return res.status(400).json({ message: 'A Client is already registered with this phone number.' });
      }
    }

    const created = await Clinic.create(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/clinics/{id}:
 *   get:
 *     summary: Get clinic details by ID
 *     tags: [Clinics]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Clinic details retrieved
 *   patch:
 *     summary: Update clinic metadata (Super Admin only)
 *     tags: [Clinics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Clinic successfully updated
 */
router.get('/:id', async (req, res, next) => {
  try {
    const clinic = await Clinic.findById(req.params.id).lean();
    if (!clinic) return res.status(404).json({ message: 'Clinic not found' });
    res.json(clinic);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', optionalVerify, async (req, res, next) => {
  try {
    const { address, contact } = req.body;

    if (contact && contact.phone !== undefined) {
      if (!/^\d{10}$/.test(contact.phone)) {
        return res.status(400).json({ message: 'Phone number must be exactly 10 digits (numeric only)' });
      }
    }

    if (address && address.postal_code !== undefined) {
      if (!/^\d{6}$/.test(address.postal_code)) {
        return res.status(400).json({ message: 'Postal code must be exactly 6 digits (numeric only)' });
      }
    }

    const { default: mongoose } = await import('mongoose');
    const Vet = mongoose.models.Vet;
    const Client = mongoose.models.Client;

    if (contact && contact.email) {
      const emailLower = contact.email.toLowerCase();
      const existingByEmail = await Clinic.findOne({ 'contact.email': emailLower, _id: { $ne: req.params.id } });
      if (existingByEmail) return res.status(400).json({ message: 'A clinic is already registered with this email address' });
      
      if (Vet) {
        const vetConflict = await Vet.findOne({ email: emailLower });
        if (vetConflict) return res.status(400).json({ message: 'A Vet is already registered with this email address.' });
      }
      if (Client) {
        const clientConflict = await Client.findOne({ email: emailLower });
        if (clientConflict) return res.status(400).json({ message: 'A Client is already registered with this email address.' });
      }
    }

    if (contact && contact.phone) {
      const existingByPhone = await Clinic.findOne({ 'contact.phone': contact.phone, _id: { $ne: req.params.id } });
      if (existingByPhone) return res.status(400).json({ message: 'A clinic is already registered with this phone number' });
      
      if (Vet) {
        const vetPhoneConflict = await Vet.findOne({ phone: contact.phone });
        if (vetPhoneConflict) return res.status(400).json({ message: 'A Vet is already registered with this phone number.' });
      }
      if (Client) {
        const clientPhoneConflict = await Client.findOne({ phone: contact.phone });
        if (clientPhoneConflict) return res.status(400).json({ message: 'A Client is already registered with this phone number.' });
      }
    }

    const updated = await Clinic.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Clinic not found' });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', optionalVerify, async (req, res, next) => {
  try {
    const deleted = await Clinic.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Clinic not found' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
