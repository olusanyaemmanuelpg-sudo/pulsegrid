import { Router } from 'express';
import { handleRegister } from '../controller/registerController.js';

const router = Router();

router.post('/', (req, res) => handleRegister(req, res));

export default router;
