import { Router } from 'express';
import { handleLogin } from '../controller/loginController.js';

const router = Router();

router.post('/', handleLogin);

export default router;
