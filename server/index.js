import 'dotenv/config';
import { createApp } from './app.js';

// Local development entry (`npm start`). On Vercel, see api/index.js.
const PORT = Number(process.env.PORT) || 3000;
const app = createApp({ serveStatic: true });

app.listen(PORT, () => {
  console.log(`CSUN Career Kiosk server running at http://localhost:${PORT}`);
  console.log(`  Kiosk:  http://localhost:${PORT}/`);
  console.log(`  Admin:  http://localhost:${PORT}/admin/`);
});
