import { Router } from 'express';
import { createMonitor } from '../controller/monitorController.js';
import { getMonitors } from '../controller/monitorController.js';
import { deleteMonitor } from '../controller/monitorController.js';
import { testMonitor } from '../controller/monitorController.js';

const router = Router();

router.post('/', createMonitor);
router.get('/', getMonitors);
router.delete('/:id', deleteMonitor);
router.post('/:id/test', testMonitor);

export default router;
