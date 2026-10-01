import { Router } from 'express';
import { receiveHeartbeat } from '../controller/heartbeats.js';

const router = Router();

router.get('/:id', receiveHeartbeat);
router.post('/:id', receiveHeartbeat);

export default router;