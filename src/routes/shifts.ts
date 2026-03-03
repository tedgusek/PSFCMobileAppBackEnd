import express from 'express';
import { getCachedShifts } from '../services/cached';
import { db } from '../db';
import { triggerImmediateRescrape } from '../server';

const router = express.Router();

// ─── GET /api/shifts ──────────────────────────────────────────────────────────
// Returns the cached shift list, filtered to remove any already-claimed shifts.

router.get('/shifts', async (_req: any, res: any) => {
  try {
    const data = getCachedShifts();

    if (!data || Object.keys(data).length === 0) {
      return res
        .status(503)
        .json({
          error: 'Shift data not available yet. Please try again in a moment.',
        });
    }

    // Filter out shifts that have already been claimed via this app
    const claimedResult = await db.query(
      `SELECT shift_key FROM shift_claims WHERE status = 'confirmed'`,
    );
    const claimedSet = new Set<string>(
      claimedResult.rows.map((r: any) => r.shift_key),
    );

    const filtered: Record<string, { time: string; description: string }[]> =
      {};

    for (const [date, shifts] of Object.entries(data)) {
      const available = shifts.filter(
        (s) => !claimedSet.has(`${date}|${s.time}|${s.description}`),
      );
      if (available.length > 0) {
        filtered[date] = available;
      }
    }

    res.json(filtered);
  } catch (err) {
    console.error('❌ Error fetching shifts:', err);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// ─── POST /api/shifts/claim ───────────────────────────────────────────────────
// Atomically claims a shift for a user.
// Body: { date: string, time: string, description: string, username: string }

router.post('/shifts/claim', async (req: any, res: any) => {
  const { date, time, description, username } = req.body;

  if (!date || !time || !description || !username) {
    return res
      .status(400)
      .json({
        error: 'Missing required fields: date, time, description, username',
      });
  }

  const shiftKey = `${date}|${time}|${description}`;

  // Step 1 — Try to atomically insert the claim.
  // The UNIQUE constraint on shift_key means only one user can succeed.
  try {
    await db.query(
      `INSERT INTO shift_claims (shift_key, claimed_by, status) VALUES ($1, $2, 'pending')`,
      [shiftKey, username],
    );
  } catch (err: any) {
    // Postgres unique violation error code = 23505
    if (err.code === '23505') {
      return res
        .status(409)
        .json({ error: 'Sorry, this shift was just claimed by someone else.' });
    }
    console.error('❌ DB error during claim insert:', err);
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }

  // Step 2 — Trigger a fast rescrape so the cache reflects this change quickly
  triggerImmediateRescrape();

  // Step 3 — TODO: Add Puppeteer-based signup submission here when ready.
  // For now we confirm the claim optimistically.
  // When you implement the actual Puppeteer signup:
  //   - On success: UPDATE shift_claims SET status='confirmed' WHERE shift_key=$1
  //   - On failure: DELETE FROM shift_claims WHERE shift_key=$1, then return 500

  try {
    await db.query(
      `UPDATE shift_claims SET status = 'confirmed' WHERE shift_key = $1`,
      [shiftKey],
    );
  } catch (err) {
    console.error('❌ Failed to confirm claim:', err);
    // Roll back the claim so another user can try
    await db.query(`DELETE FROM shift_claims WHERE shift_key = $1`, [shiftKey]);
    return res
      .status(500)
      .json({ error: 'Failed to confirm signup. Please try again.' });
  }

  console.log(`✅ Shift claimed: ${shiftKey} by ${username}`);
  res.json({ success: true, message: 'Shift successfully claimed!' });
});

export const shiftsRouter = router;
