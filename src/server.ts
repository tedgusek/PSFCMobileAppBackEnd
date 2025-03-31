// // 🔹 Schedule Scraping Every 60 Seconds
// async function startScraping() {
//   await initBrowser();
//   await login();
//   if (!fs.existsSync(SESSION_FILE)) {
//     await login();
//   }
//   await scrapeShifts();
//   // setInterval(scrapeShifts, 60000);
//   // setInterval(scrapeShifts, 5000);
// }

// // 🔹 API Endpoint to Get Scraped Shifts
// app.get('/shifts', (req: Request, res: Response) => {
//   res.json({ shifts: shiftsData });
// });

// // 🔹 Start the Server and Begin Scraping
// app.listen(PORT, async () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
//   await startScraping();
// });
import express from 'express';
import { config } from './config';
import shiftsRoutes from './routes/shifts';
import { initBrowser, closeBrowser } from './services/browser';
import { login, scrapeShifts } from './services/scraperService';

const app = express();
app.use(express.json());
app.use('/api', shiftsRoutes);

app.listen(config.PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${config.PORT}`);
  try {
    await initBrowser();
    await login();
    await scrapeShifts();
  } catch (error) {
    console.error('❌ Error initializing scraper:', error);
  }
});

process.on('SIGINT', async () => {
  await closeBrowser();
  console.log('👋 Server shutting down');
  process.exit();
});
