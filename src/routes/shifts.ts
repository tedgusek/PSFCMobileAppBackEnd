// import express from 'express';
// import { scrapeShifts } from '../services/scraperService';

// const router = express.Router();

// // router.get('/shifts', async (req, res) => {
// //   try {
// //     const shifts = await scrapeShifts();
// //     res.json({ shifts });
// //   } catch (error) {
// //     res.status(500).json({ error: error.message });
// //   }
// // });

// router.get('/shifts', async (req, res) => {
//   try {
//     const shifts = await scrapeShifts();
//     res.json({ shifts });
//   } catch (error) {
//     const errMsg = (error as Error).message || 'An unknown error occurred';
//     res.status(500).json({ error: errMsg });
//   }
// });

// export default router;
////////////////////////////////////////////////////////////////////////////////////
// import express from 'express';
// import { getCachedShifts } from '../server'; // import cached shifts

// const router = express.Router();

// // GET /api/shifts
// router.get('/shifts', (req, res) => {
//   const data = getCachedShifts();

//   if (!data || Object.keys(data).length === 0) {
//     return res.status(503).json({ error: 'Shift data not available yet' });
//   }

//   res.json(data);
// });

// export default router;
//////////////////////////////////////////////////////////////////////////////////////
// import express from 'express';
// import { getCachedShifts } from '../server';

// const router = express.Router();

// router.get('/shifts', (_req, res) => {
//   const data = getCachedShifts();

//   if (!data || Object.keys(data).length === 0) {
//     return res.status(503).json({ error: 'Shift data not available yet' });
//   }

//   res.json(data);
// });

// export default router;
///////////////////////////////////////////
// import express from 'express';
// import { getCachedShifts } from '../services/cached';

// const router = express.Router();

// router.get('/shifts', (_req, res) => {
//   const data = getCachedShifts();

//   if (!data || Object.keys(data).length === 0) {
//     return res.status(503).json({ error: 'Shift data not available yet' });
//   }

//   res.json(data);
// });

// export default router;
///////////////////////////////////

// import express from 'express';
// import { getCachedShifts } from '../services/cached';

// // const router = express.Router();
// import type { Router } from 'express';
// const router: Router = express.Router();

// router.get('/shifts', (_req, res) => {
//   const data = getCachedShifts();

//   if (!data || Object.keys(data).length === 0) {
//     return res.status(503).json({ error: 'Shift data not available yet' });
//   }

//   res.json(data);
// });

// export default router;
///////////////////////////

import express, { Router } from 'express';
import { getCachedShifts } from '../services/cached';

const router = express.Router();

router.get('/shifts', (_req: Request, res: any) => {
  const data = getCachedShifts();

  if (!data || Object.keys(data).length === 0) {
    return res.status(503).json({ error: 'Shift data not available yet' });
  }

  res.json(data);
});

export const shiftsRouter = router; // ✅ Named export
