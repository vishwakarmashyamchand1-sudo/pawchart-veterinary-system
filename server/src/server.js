import 'dotenv/config';
console.log("MONGO_URI =", process.env.MONGO_URI);
import cors from 'cors';
import express from 'express';
import { connectDb } from './db.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import authRouter from './routes/auth.js';
import clinicsRouter from './routes/clinics.js';
import aiRouter from './routes/ai.js';
import dashboardRouter from './routes/dashboard.js';
import crudRouter from './routes/crud.js';
import { initReminderScheduler } from './services/reminderService.js';

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pawchart';

const clientOrigin = process.env.CLIENT_ORIGIN;

app.use(cors({
  origin: clientOrigin ? [clientOrigin, 'http://localhost:3000'] : true,
  credentials: true
}));

app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (error) {
    next(error);
  }
});


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRouter);
app.use('/api/clinics', clinicsRouter);
app.use('/api/ai', aiRouter);



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

app.use('/api/dashboard', dashboardRouter);
app.use('/api', crudRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'pawchart-api' });
});

app.use((error, _req, res, _next) => {
  console.error(error);

  // Handle Mongoose duplicate key error specifically
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    let fieldName = field;
    if (field === 'contact.email') fieldName = 'email';
    if (field === 'contact.phone') fieldName = 'phone';
    if (field === 'registration_number') fieldName = 'registration number';
    
    return res.status(400).json({ 
      message: `The ${fieldName} '${error.keyValue[field]}' is already registered. Please use a unique value.` 
    });
  }

  res.status(error.status || 500).json({ message: error.message || 'Unexpected server error' });
});

if (!process.env.VERCEL) {
  try {
    await connectDb();
    await initReminderScheduler();
    app.listen(port, () => {
      console.log(`PawChart API listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error(`Could not connect to MongoDB. Start your local MongoDB service or update server/.env with a MongoDB Atlas URI.`);
    console.error(error.message);
    process.exit(1);
  }
}

export default app;
