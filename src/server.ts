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

const NORMAL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes during quiet periods
const FAST_INTERVAL_MS = 30 * 1000; // 30 seconds right after a signup

let pollTimer: NodeJS.Timeout | null = null;
let isScrapingLocked = false; // Prevents overlapping scrape runs

/**
 * Scrapes the site, diffs against the previous cache, and logs any
 * shifts that disappeared (i.e. were taken by someone outside the app).
 */
async function scrapeAndDetectChanges(): Promise<void> {
  if (isScrapingLocked) {
    console.log('⏳ Scrape already in progress, skipping this tick');
    return;
  }

  isScrapingLocked = true;

  try {
    const previous = getCachedShifts();
    const current = await scrapeShifts();

    // ── Diff: find shifts that existed before but are gone now ──
    const disappeared: { date: string; time: string; description: string }[] =
      [];

    for (const [date, prevShifts] of Object.entries(previous)) {
      const currShifts = current[date] ?? [];
      const currKeys = new Set(
        currShifts.map((s) => `${s.time}|${s.description}`),
      );

      for (const shift of prevShifts) {
        const key = `${shift.time}|${shift.description}`;
        if (!currKeys.has(key)) {
          disappeared.push({ date, ...shift });
        }
      }
    }

    if (disappeared.length > 0) {
      console.log(
        `⚠️  ${disappeared.length} shift(s) were taken externally:`,
        disappeared,
      );
      // TODO: When you add push notifications, call notifyAffectedUsers(disappeared) here
    }

    setCachedShifts(current);
    console.log('🔄 Shift cache updated');
  } catch (err) {
    console.error('❌ Failed to scrape shifts:', err);
  } finally {
    isScrapingLocked = false;
  }
}

/**
 * Schedules the next scrape after `delay` ms.
 * Always clears any existing timer first so there's never two running at once.
 */
function schedulePoll(delay: number): void {
  if (pollTimer) clearTimeout(pollTimer);

  pollTimer = setTimeout(async () => {
    await scrapeAndDetectChanges();
    schedulePoll(NORMAL_INTERVAL_MS); // Always return to normal cadence after each run
  }, delay);
}

/**
 * Call this from the /api/shifts/claim route immediately after a successful
 * signup. It cancels the current timer and fires a fresh scrape in 30 seconds
 * so the cache reflects the change almost immediately.
 */
export function triggerImmediateRescrape(): void {
  console.log('⚡ Signup detected — scheduling fast rescrape in 30 seconds');
  schedulePoll(FAST_INTERVAL_MS);
}

// ─── Startup ─────────────────────────────────────────────────────────────────

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
    schedulePoll(NORMAL_INTERVAL_MS); // Kick off the adaptive polling loop
  } catch (error) {
    console.error('❌ Error initializing scraper:', error);
  }
});

// ─── DB health check ─────────────────────────────────────────────────────────

async function testDb(): Promise<void> {
  try {
    const res = await db.query('SELECT NOW()');
    console.log('✅ Connected to Neon DB:', res.rows[0]);
  } catch (err) {
    console.error('❌ DB Connection Error:', err);
  }
}
testDb();

// ─── Graceful shutdown ───────────────────────────────────────────────────────

process.on('SIGINT', async () => {
  if (pollTimer) clearTimeout(pollTimer);
  await closeBrowser();
  console.log('👋 Server shutting down');
  process.exit();
});
