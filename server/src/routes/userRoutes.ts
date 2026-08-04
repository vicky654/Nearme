import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { updateProfileSchema, changePasswordSchema, updateSettingsSchema } from '../validators/userValidators';
import { getMe, updateMe, changePassword, getSettings, updateSettings, updateLocation, getNearbyUsers, searchUsers } from '../controllers/userController';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', validate(updateProfileSchema), updateMe);
router.patch('/me/password', validate(changePasswordSchema), changePassword);
router.get('/me/settings', getSettings);
router.patch('/me/settings', validate(updateSettingsSchema), updateSettings);

router.patch('/location', updateLocation);
router.get('/nearby', getNearbyUsers);
router.get('/search', searchUsers);

export default router;
