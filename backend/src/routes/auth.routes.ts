import { Router } from 'express';
import { handleRegister, handleLogin, handleRecover, handleLogout, handleMe, handleUnlock } from '../controllers/auth.controller';

const router = Router();

router.post('/register', handleRegister);
router.post('/login', handleLogin);
router.post('/recover', handleRecover);
router.post('/logout', handleLogout);
router.post('/unlock', handleUnlock);
router.get('/me', handleMe);

export default router;
