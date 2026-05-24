// Centralized API configuration layer
// This file is environment-aware and deployment-ready.

// In local development, it defaults to http://localhost:5000/api.
// On Vercel, it automatically uses the VITE_API_URL environment variable if set.
const LOCAL_API_URL = 'http://localhost:5000/api';

// Replace this string with your deployed production backend URL (e.g. on Vercel/Render)
const PRODUCTION_API_URL = 'https://pawchart-veterinary-backend.vercel.app/api';

// --- CHOOSE YOUR ACTIVE ENVIRONMENT HERE ---
// By default, VITE_API_URL env variable will be used if present, otherwise fallback to local/prod toggles.
export const API_BASE_URL = import.meta.env.VITE_API_URL || LOCAL_API_URL;
// export const API_BASE_URL = PRODUCTION_API_URL; 

export default API_BASE_URL;
