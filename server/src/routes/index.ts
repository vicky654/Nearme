import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;
