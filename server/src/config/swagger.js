import swaggerJsdoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PawChart Veterinary Clinic API',
      version: '1.0.0',
      description: 'Interactive API sandbox for PawChart Veterinary Clinic Management System',
      contact: {
        name: 'PawChart Team',
        email: 'support@pawchart.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from login/signup'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Dashboard', description: 'Dashboard stats and overview' },
      { name: 'Vets', description: 'Veterinarians onboarding & management' },
      { name: 'Clients', description: 'Pet Owners & Pets profiles' },
      { name: 'Appointments', description: 'Appointment bookings & calendar' },
      { name: 'AI Consultation', description: 'Claude-based transcript processing & SOAP notes' }
    ]
  },
  apis: ['./src/server.js', './src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
