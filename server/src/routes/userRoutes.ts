import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { locationRateLimiter } from '../middleware/rateLimiters';
import { updateProfileSchema, changePasswordSchema, updateSettingsSchema, updateLocationSchema } from '../validators/userValidators';
import { getMe, updateMe, changePassword, getSettings, updateSettings, registerPushToken, unregisterPushToken, updateLocation, getNearbyUsers, searchUsers } from '../controllers/userController';

const router = Router();

router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', validate(updateProfileSchema), updateMe);
router.patch('/me/password', validate(changePasswordSchema), changePassword);
router.get('/me/settings', getSettings);
router.patch('/me/settings', validate(updateSettingsSchema), updateSettings);
router.put('/me/push-token', registerPushToken);
router.delete('/me/push-token', unregisterPushToken);

router.patch('/location', locationRateLimiter, validate(updateLocationSchema), updateLocation);
router.get('/nearby', getNearbyUsers);
router.get('/search', searchUsers);

export default router;
