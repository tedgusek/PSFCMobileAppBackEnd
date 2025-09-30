// // // 🔹 Schedule Scraping Every 60 Seconds
// // async function startScraping() {
// //   await initBrowser();
// //   await login();
// //   if (!fs.existsSync(SESSION_FILE)) {
// //     await login();
// //   }
// //   await scrapeShifts();
// //   // setInterval(scrapeShifts, 60000);
// //   // setInterval(scrapeShifts, 5000);
// // }

// // // 🔹 API Endpoint to Get Scraped Shifts
// // app.get('/shifts', (req: Request, res: Response) => {
// //   res.json({ shifts: shiftsData });
// // });

// // // 🔹 Start the Server and Begin Scraping
// // app.listen(PORT, async () => {
// //   console.log(`🚀 Server running on http://localhost:${PORT}`);
// //   await startScraping();
// // });
// import express from 'express';
// import { config } from './config';
// import shiftsRoutes from './routes/shifts';
// import { initBrowser, closeBrowser } from './services/browser';
// import { login, scrapeShifts } from './services/scraperService';
// import { db } from './db';

// const app = express();
// app.use(express.json());
// app.use('/api', shiftsRoutes);

// const router = express.Router();

// app.listen(config.PORT, async () => {
//   console.log(`🚀 Server running on http://localhost:${config.PORT}`);
//   try {
//     await initBrowser();
//     await login();
//     // await scrapeShifts();
//   } catch (error) {
//     console.error('❌ Error initializing scraper:', error);
//   }
// });

// router.get('/api', async (req, res) => {
//   console.log('am i here yet');
//   try {
//     const data = await scrapeShifts();
//     res.json(data);
//   } catch (err) {
//     console.log('error scraping Shifts: ', err);
//     res.status(500).json({ error: 'failed to scrape shifts' });
//   }
// });

// async function testDb() {
//   try {
//     const res = await db.query('SELECT NOW()');
//     console.log('✅ Connected to Neon DB:', res.rows[0]);
//   } catch (err) {
//     console.error('❌ DB Connection Error:', err);
//   }
// }

// testDb();

// process.on('SIGINT', async () => {
//   await closeBrowser();
//   console.log('👋 Server shutting down');
//   process.exit();
// });

// export default router;

import express from 'express';
import { config } from './config';
import { shiftsRouter } from './routes/shifts';
import { initBrowser, closeBrowser } from './services/browser';
import { login, scrapeShifts } from './services/scraperService';
import { db } from './db';
import { setCachedShifts } from './services/cached';

// console.log(typeof shiftsRoutes); // should log 'function' (Router is a function object)

const app = express();
app.use(express.json());
app.use('/api', shiftsRouter);

let cachedShiftsData = {}; // Shared in-memory cache

async function startScraping() {
  await initBrowser();
  await login();
  const data = await scrapeShifts();
  setCachedShifts(data);
  console.log('✅ Initial shift data scraped and cached');
}

app.listen(config.PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${config.PORT}`);
  try {
    await startScraping();

    // OPTIONAL: refresh shifts every 5 minutes
    setInterval(async () => {
      try {
        cachedShiftsData = await scrapeShifts();
        console.log('🔄 Shift data updated');
      } catch (err) {
        console.error('❌ Failed to update shift data:', err);
      }
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error('❌ Error initializing scraper:', error);
  }
});

// Make cached data available to route files
// export function getCachedShifts() {
//   return cachedShiftsData;
// }

// Optional DB test
async function testDb() {
  try {
    const res = await db.query('SELECT NOW()');
    console.log('✅ Connected to Neon DB:', res.rows[0]);
  } catch (err) {
    console.error('❌ DB Connection Error:', err);
  }
}
testDb();

process.on('SIGINT', async () => {
  await closeBrowser();
  console.log('👋 Server shutting down');
  process.exit();
});
