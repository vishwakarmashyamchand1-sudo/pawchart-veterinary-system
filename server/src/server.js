import 'dotenv/config';
console.log("MONGO_URI =", process.env.MONGO_URI);
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { connectDb } from './db.js';
import { Appointment, Client, FollowUp, SoapNote, Vaccination, Vet, WeightLog } from './models.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import authRouter from './routes/auth.js';
import { optionalAuth } from './middleware/auth.js';
import clinicsRouter from './routes/clinics.js';
import aiRouter from './routes/ai.js';
import { initReminderScheduler } from './services/reminderService.js';

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRouter);
app.use('/api/clinics', clinicsRouter);
app.use('/api/ai', aiRouter);

const resources = {
  vets: Vet,
  clients: Client,
  appointments: Appointment,
  vaccinations: Vaccination,
  followups: FollowUp,
  weights: WeightLog,
  soapnotes: SoapNote
};

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Retrieve server health status
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Server is running and healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 service:
 *                   type: string
 * */

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     summary: Retrieve aggregate dashboard stats
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard stats successfully fetched
 */

/**
 * @openapi
 * /api/vets:
 *   get:
 *     summary: Get all onboarded veterinarians
 *     tags: [Vets]
 *     responses:
 *       200:
 *         description: List of veterinarians
 *   post:
 *     summary: Onboard a new veterinarian
 *     tags: [Vets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               specialization:
 *                 type: string
 *               license:
 *                 type: string
 *               room:
 *                 type: string
 *     responses:
 *       201:
 *         description: Vet created successfully
 */

/**
 * @openapi
 * /api/clients:
 *   get:
 *     summary: Retrieve all clients and their pets
 *     tags: [Clients]
 *     responses:
 *       200:
 *         description: List of clients
 *   post:
 *     summary: Register a new client with embedded pet profile
 *     tags: [Clients]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               pets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     species:
 *                       type: string
 *                     breed:
 *                       type: string
 *                     age:
 *                       type: string
 *     responses:
 *       201:
 *         description: Client registered successfully
 */

/**
 * @openapi
 * /api/appointments:
 *   get:
 *     summary: Retrieve all appointments
 *     tags: [Appointments]
 *     responses:
 *       200:
 *         description: List of appointments
 *   post:
 *     summary: Create/schedule a new appointment
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - petName
 *               - ownerName
 *               - reason
 *               - date
 *               - time
 *             properties:
 *               petName:
 *                 type: string
 *               ownerName:
 *                 type: string
 *               vetName:
 *                 type: string
 *               reason:
 *                 type: string
 *               date:
 *                 type: string
 *               time:
 *                 type: string
 *               type:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Appointment created successfully
 */

const getQueryFilter = (req) => {
  const clinicId = req.header('x-clinic-id') || req.query.clinic_id || (req.user && req.user.clinicId);
  if (clinicId) {
    let clinicObjId = clinicId;
    if (mongoose.Types.ObjectId.isValid(clinicId)) {
      clinicObjId = new mongoose.Types.ObjectId(clinicId);
    }
    return { clinic_id: clinicObjId };
  }
  return {};
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'pawchart-api' });
});

app.get('/api/dashboard', optionalAuth, async (req, res, next) => {
  try {
    const filter = getQueryFilter(req);
    const [appointments, clients, vaccinations, followUps, vets] = await Promise.all([
      Appointment.find(filter).sort({ date: 1, time: 1 }).lean(),
      Client.find(filter).lean(),
      Vaccination.find(filter).lean(),
      FollowUp.find(filter).lean(),
      Vet.find(filter).lean()
    ]);
    const activePatients = clients.reduce((total, client) => total + client.pets.length, 0);

    // Compute dynamic today's & yesterday's date strings
    const todayStr = new Date().toISOString().split('T')[0]; // '2026-05-23'
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0]; // '2026-05-22'

    // appointments comparison
    const apptsToday = appointments.filter((item) => item.date === todayStr).length;
    const apptsYesterday = appointments.filter((item) => item.date === yesterdayStr).length;
    const apptsDiff = apptsToday - apptsYesterday;
    const apptsHint = apptsDiff >= 0 
      ? `+${apptsDiff} appointments compared to yesterday` 
      : `${apptsDiff} appointments compared to yesterday`;

    // Active patients comparison
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const yesterdayStart = new Date(); yesterdayStart.setDate(yesterdayStart.getDate() - 1); yesterdayStart.setHours(0,0,0,0);
    const clientsToday = clients.filter(c => new Date(c.createdAt) >= todayStart);
    const clientsYesterday = clients.filter(c => new Date(c.createdAt) >= yesterdayStart && new Date(c.createdAt) < todayStart);
    const petsToday = clientsToday.reduce((sum, c) => sum + (c.pets || []).length, 0);
    const petsYesterday = clientsYesterday.reduce((sum, c) => sum + (c.pets || []).length, 0);
    const patientsDiff = petsToday - petsYesterday;
    const patientsHint = patientsDiff >= 0
      ? `+${patientsDiff} active patients compared to yesterday`
      : `${patientsDiff} active patients compared to yesterday`;

    // Vaccines comparison
    const vaxDue = vaccinations.filter((item) => item.status !== 'Up to date').length;
    const vaxDueToday = vaccinations.filter(v => v.dueDate <= todayStr && v.status !== 'Up to date').length;
    const vaxDueYesterday = vaccinations.filter(v => v.dueDate <= yesterdayStr && v.status !== 'Up to date').length;
    const vaxDiff = vaxDueToday - vaxDueYesterday;
    const vaxHint = vaxDiff >= 0 
      ? `+${vaxDiff} due compared to yesterday` 
      : `${vaxDiff} due compared to yesterday`;

    // Follow ups pending comparison
    const followPending = followUps.filter((item) => item.status === 'Pending').length;
    const followPendingToday = followUps.filter(f => f.planDate <= todayStr && f.status === 'Pending').length;
    const followPendingYesterday = followUps.filter(f => f.planDate <= yesterdayStr && f.status === 'Pending').length;
    const followDiff = followPendingToday - followPendingYesterday;
    const followHint = followDiff >= 0 
      ? `+${followDiff} more pending than yesterday` 
      : `${followDiff} fewer pending than yesterday`;

    res.json({
      stats: {
        appointmentsToday: apptsToday,
        appointmentsTodayHint: apptsHint,
        activePatients,
        activePatientsHint: patientsHint,
        vaccinesDue: vaxDue,
        vaccinesDueHint: vaxHint,
        followUpsPending: followPending,
        followUpsPendingHint: followHint,
        veterinarianCount: vets.length
      },
      appointments: appointments.slice(0, 5),
      alerts: vaccinations.filter((item) => item.status !== 'Up to date').slice(0, 4),
      monitoring: followUps.filter((item) => item.monitoring)
    });
  } catch (error) {
    next(error);
  }
});

Object.entries(resources).forEach(([name, Model]) => {
  app.get(`/api/${name}`, optionalAuth, async (req, res, next) => {
    try {
      const filter = getQueryFilter(req);
      res.json(await Model.find(filter).sort({ createdAt: -1 }).lean());
    } catch (error) {
      next(error);
    }
  });

  app.post(`/api/${name}`, optionalAuth, async (req, res, next) => {
    try {
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
  });

  app.patch(`/api/${name}/:id`, optionalAuth, async (req, res, next) => {
    try {
      const updated = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ message: `${name} record not found` });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete(`/api/${name}/:id`, optionalAuth, async (req, res, next) => {
    try {
      const deleted = await Model.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: `${name} record not found` });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Unexpected server error' });
});

try {
  await connectDb(mongoUri);
  await initReminderScheduler();
  app.listen(port, () => {
    console.log(`PawChart API listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error(`Could not connect to MongoDB at ${mongoUri}. Start your local MongoDB service or update server/.env with a MongoDB Atlas URI.`);
  console.error(error.message);
  process.exit(1);
}
