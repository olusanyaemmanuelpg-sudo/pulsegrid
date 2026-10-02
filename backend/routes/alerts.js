import { Router } from 'express';
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  testChannel,
} from '../controller/alertController.js';

const router = Router();

router.get('/channels', getChannels);
router.post('/channels', createChannel);
router.put('/channels/:id', updateChannel);
router.delete('/channels/:id', deleteChannel);
router.post('/channels/:id/test', testChannel);

export default router;
