import { Router } from 'express';
import { handleRegister } from '../controller/registerController.js';

const router = Router();

router.post('/', handleRegister);

export default router;
