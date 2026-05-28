import { getQueryFilter } from '../middleware/auth.js';
import { triggerMailFlows } from '../services/mailService.js';

export const createCrudHandlers = (Model, resourceName) => {
  return {
    getAll: async (req, res, next) => {
      try {
        const filter = getQueryFilter(req);
        
        // Pagination logic
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        let query = Model.find(filter);
        if (resourceName === 'FollowUp' || resourceName === 'Appointment' || resourceName === 'SoapNote') {
          query = query.populate('clinic_id');
        }

        const [data, totalRecords] = await Promise.all([
          query.sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
          Model.countDocuments(filter)
        ]);

        res.json({
          data,
          meta: {
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            currentPage: page,
            limit
          }
        });
      } catch (error) { next(error); }
    },
    getOne: async (req, res, next) => {
      try {
        const filter = { _id: req.params.id, ...getQueryFilter(req) };
        const item = await Model.findOne(filter).lean();
        if (!item) return res.status(404).json({ message: `${resourceName} not found` });
        res.json(item);
      } catch (error) { next(error); }
    },
    create: async (req, res, next) => {
      try {
        const body = { ...req.body };
        const clinicId = req.header('x-clinic-id') || req.query.clinic_id || (req.user && req.user.clinicId);
        if (clinicId) { body.clinic_id = clinicId; }

        if (body.email) {
          const existing = await Model.findOne({ email: body.email });
          if (existing) return res.status(400).json({ message: `The email '${body.email}' is already registered. Please use a unique value.` });
          
          if (resourceName === 'Vet' || resourceName === 'Client') {
             const { default: mongoose } = await import('mongoose');
                const Clinic = mongoose.models.Clinic;
                if (Clinic) {
                   const clinicConflict = await Clinic.findOne({ 'contact.email': body.email.toLowerCase() });
                   if (clinicConflict) throw new Error(`The email '${body.email}' is already registered as a Clinic.`);
                }
                const OtherModel = mongoose.models[resourceName === 'Vet' ? 'Client' : 'Vet'];
                if (OtherModel) {
                   const otherConflict = await OtherModel.findOne({ email: body.email });
                   if (otherConflict) throw new Error(`The email '${body.email}' is already registered.`);
                }

          }
        }
        if (body.phone) {
          const existing = await Model.findOne({ phone: body.phone });
          if (existing) return res.status(400).json({ message: `The phone '${body.phone}' is already registered. Please use a unique value.` });
          
          if (resourceName === 'Vet' || resourceName === 'Client') {
             const { default: mongoose } = await import('mongoose');
                const Clinic = mongoose.models.Clinic;
                if (Clinic) {
                   const clinicConflict = await Clinic.findOne({ 'contact.phone': body.phone });
                   if (clinicConflict) throw new Error(`The phone '${body.phone}' is already registered as a Clinic.`);
                }
                const OtherModel = mongoose.models[resourceName === 'Vet' ? 'Client' : 'Vet'];
                if (OtherModel) {
                   const otherConflict = await OtherModel.findOne({ phone: body.phone });
                   if (otherConflict) throw new Error(`The phone '${body.phone}' is already registered.`);
                }

          }
        }

        if (resourceName === 'Appointment') {
          const conflictQuery = {
            vetName: body.vetName,
            date: body.date,
            time: body.time,
            status: { $ne: 'Cancelled' }
          };
          if (clinicId) conflictQuery.clinic_id = clinicId;
          
          const conflict = await Model.findOne(conflictQuery);
          if (conflict) {
            return res.status(409).json({ message: `Conflict: ${body.vetName} is already booked at ${body.time}. Please select a different time.` });
          }
        }

        const created = await Model.create(body);

        // Trigger dynamic mail notification flows based on resourceName
        if (resourceName === 'Appointment' || resourceName === 'SoapNote') {
          const resourceLower = resourceName === 'Appointment' ? 'appointments' : 'soapnotes';
          triggerMailFlows(resourceLower, created, clinicId, req.headers.host).catch(err => {
            console.error(`❌ Error executing triggerMailFlows for ${resourceName}:`, err.message);
          });
        }

        res.status(201).json(created);
      } catch (error) { next(error); }
    },
    update: async (req, res, next) => {
      try {
        const filter = { _id: req.params.id, ...getQueryFilter(req) };
        const currentDoc = await Model.findOne(filter);
        if (!currentDoc) return res.status(404).json({ message: `${resourceName} not found` });

        if (req.body.email) {
          const existing = await Model.findOne({ email: req.body.email, _id: { $ne: req.params.id } });
          if (existing) return res.status(400).json({ message: `The email '${req.body.email}' is already registered. Please use a unique value.` });
          
          if (req.body.email !== currentDoc.email && (resourceName === 'Vet' || resourceName === 'Client')) {
             const { default: mongoose } = await import('mongoose');
             const Clinic = mongoose.models.Clinic || mongoose.model('Clinic');
             if (Clinic) {
                const clinicConflict = await Clinic.findOne({ 'contact.email': req.body.email.toLowerCase() });
                if (clinicConflict) throw new Error(`The email '${req.body.email}' is already registered as a Clinic.`);
             }
             const OtherModel = mongoose.models[resourceName === 'Vet' ? 'Client' : 'Vet'];
             if (OtherModel) {
                const otherConflict = await OtherModel.findOne({ email: req.body.email });
                if (otherConflict) throw new Error(`The email '${req.body.email}' is already registered.`);
             }
          }
        }
        if (req.body.phone) {
          const existing = await Model.findOne({ phone: req.body.phone, _id: { $ne: req.params.id } });
          if (existing) return res.status(400).json({ message: `The phone '${req.body.phone}' is already registered. Please use a unique value.` });
          
          if (req.body.phone !== currentDoc.phone && (resourceName === 'Vet' || resourceName === 'Client')) {
             const { default: mongoose } = await import('mongoose');
             const Clinic = mongoose.models.Clinic || mongoose.model('Clinic');
             if (Clinic) {
                const clinicConflict = await Clinic.findOne({ 'contact.phone': req.body.phone });
                if (clinicConflict) throw new Error(`The phone '${req.body.phone}' is already registered as a Clinic.`);
             }
             const OtherModel = mongoose.models[resourceName === 'Vet' ? 'Client' : 'Vet'];
             if (OtherModel) {
                const otherConflict = await OtherModel.findOne({ phone: req.body.phone });
                if (otherConflict) throw new Error(`The phone '${req.body.phone}' is already registered.`);
             }
          }
        }

        const updated = await Model.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ message: `${resourceName} not found` });
        res.json(updated);
      } catch (error) { next(error); }
    },
    remove: async (req, res, next) => {
      try {
        const filter = { _id: req.params.id, ...getQueryFilter(req) };
        const deleted = await Model.findOneAndDelete(filter);
        if (!deleted) return res.status(404).json({ message: `${resourceName} not found` });
        res.status(204).end();
      } catch (error) { next(error); }
    }
  };
};

