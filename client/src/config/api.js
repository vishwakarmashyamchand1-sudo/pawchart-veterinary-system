// Centralized API configuration toggle system
// Toggle between LOCAL and PRODUCTION modes by commenting/uncommenting the exports below

import { LOCAL_API_URL } from './api.local.js';
import { PRODUCTION_API_URL } from './api.production.js';

// --- CHOOSE YOUR ACTIVE ENVIRONMENT HERE ---
export const API_BASE_URL = LOCAL_API_URL; // Local Development Mode (localhost backend)
// export const API_BASE_URL = PRODUCTION_API_URL; // Production Mode (deployed backend URL)

export default API_BASE_URL;
