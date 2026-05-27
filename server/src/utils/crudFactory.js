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
