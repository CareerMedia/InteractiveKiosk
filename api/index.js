import 'dotenv/config';
import { createApp } from '../server/app.js';

// Vercel serverless entry — API routes only (static files served by Vercel CDN).
export default createApp({ serveStatic: false });
