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

// ─── Health check — must respond instantly so Fly proxy sees the port ─────────
// This is checked by Fly before traffic is routed to the machine.
app.get('/health', (_req: any, res: any) => res.json({ status: 'ok' }));

app.use('/api', shiftsRouter);

// ─── Adaptive Polling ─────────────────────────────────────────────────────────

const NORMAL_INTERVAL_MS = 5 * 60 * 1000;
const FAST_INTERVAL_MS = 30 * 1000;

let pollTimer: NodeJS.Timeout | null = null;
let isScrapingLocked = false;

async function scrapeAndDetectChanges(): Promise<void> {
  if (isScrapingLocked) {
    console.log('⏳ Scrape already running, skipping');
    return;
  }
  isScrapingLocked = true;
  try {
    const previous = getCachedShifts();
    const current = await scrapeShifts();

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
    if (disappeared.length > 0 && disappeared.length < 50) {
      console.log(`⚠️  ${disappeared.length} shift(s) taken externally`);
    }

    setCachedShifts(current);
    console.log('🔄 Shift cache updated');
  } catch (err: any) {
    if (err.message === 'SIGNUP_IN_PROGRESS') {
      console.log('⏸️  Scrape skipped — signup in progress');
    } else {
      console.error('❌ Scrape failed:', err.message);
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
  console.log('⚡ Scheduling fast rescrape in 30s');
  schedulePoll(FAST_INTERVAL_MS);
}

// ─── Startup with retry ───────────────────────────────────────────────────────

async function startWithRetry(retries = 3, delayMs = 5000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔄 Startup attempt ${attempt}/${retries}...`);
      await initBrowser();
      await login();
      const data = await scrapeShifts();
      setCachedShifts(data);
      console.log('✅ Initial shift data scraped and cached');
      return;
    } catch (err: any) {
      console.error(`❌ Startup attempt ${attempt} failed:`, err.message);
      if (attempt < retries) {
        console.log(`⏳ Retrying in ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        console.error('❌ All startup attempts failed.');
      }
    }
  }
}

// ─── Start server FIRST so Fly proxy sees port 3030 immediately ───────────────
// Browser init is slow (~30s) — if we await it before listening, Fly thinks
// the machine is unhealthy and kills it before Chromium even starts.

const PORT = Number(config.PORT) || 3030;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);

  // Initialize browser in background — don't block the listening port
  startWithRetry()
    .then(() => {
      schedulePoll(NORMAL_INTERVAL_MS);
    })
    .catch((err) => {
      console.error('❌ Background startup error:', err.message);
    });
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
  console.log('👋 Shutting down');
  process.exit();
});
