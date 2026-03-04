import express from 'express';
import { config } from './config';
import { shiftsRouter } from './routes/shifts';
import { initBrowser, closeBrowser } from './services/browser';
import { login } from './services/login';
import { scrapeShifts } from './services/scraperService';
import { db } from './db';
import { setCachedShifts, getCachedShifts } from './services/cached';

const app = express();
app.use(express.json());
app.use('/api', shiftsRouter);

// ─── Adaptive Polling ────────────────────────────────────────────────────────

const NORMAL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FAST_INTERVAL_MS = 30 * 1000; // 30 seconds after a signup

let pollTimer: NodeJS.Timeout | null = null;
let isScrapingLocked = false;

async function scrapeAndDetectChanges(): Promise<void> {
  if (isScrapingLocked) {
    console.log('⏳ Scrape already running, skipping this tick');
    return;
  }

  isScrapingLocked = true;

  try {
    const previous = getCachedShifts();
    const current = await scrapeShifts();

    // Diff — find shifts that disappeared since last scrape
    const disappeared: { date: string; time: string; description: string }[] =
      [];
    for (const [date, prevShifts] of Object.entries(previous)) {
      const currKeys = new Set(
        (current[date] ?? []).map((s) => `${s.time}|${s.description}`),
      );
      for (const shift of prevShifts) {
        if (!currKeys.has(`${shift.time}|${shift.description}`)) {
          disappeared.push({ date, ...shift });
        }
      }
    }

    if (disappeared.length > 0) {
      console.log(
        `⚠️  ${disappeared.length} shift(s) were taken externally:`,
        disappeared,
      );
    }

    setCachedShifts(current);
    console.log('🔄 Shift cache updated');
  } catch (err: any) {
    if (err.message === 'SIGNUP_IN_PROGRESS') {
      console.log(
        '⏸️  Scrape skipped — signup in progress, will retry at next interval',
      );
    } else {
      console.error('❌ Failed to scrape shifts:', err);
    }
  } finally {
    isScrapingLocked = false;
  }
}

function schedulePoll(delay: number): void {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    await scrapeAndDetectChanges();
    schedulePoll(NORMAL_INTERVAL_MS);
  }, delay);
}

export function triggerImmediateRescrape(): void {
  console.log('⚡ Signup completed — scheduling fast rescrape in 30s');
  schedulePoll(FAST_INTERVAL_MS);
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function startScraping(): Promise<void> {
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
    schedulePoll(NORMAL_INTERVAL_MS);
  } catch (error) {
    console.error('❌ Error initializing scraper:', error);
  }
});

// ─── DB health check ──────────────────────────────────────────────────────────

async function testDb(): Promise<void> {
  try {
    const res = await db.query('SELECT NOW()');
    console.log('✅ Connected to Neon DB:', res.rows[0]);
  } catch (err) {
    console.error('❌ DB Connection Error:', err);
  }
}
testDb();

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGINT', async () => {
  if (pollTimer) clearTimeout(pollTimer);
  await closeBrowser();
  console.log('👋 Server shutting down');
  process.exit();
});
