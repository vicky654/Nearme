import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getFriends,
  getFriendRequests,
  reportUser,
} from '../controllers/friendController';

const router = Router();

router.use(authenticate);

router.post('/request', sendFriendRequest);
router.post('/accept', acceptFriendRequest);
router.post('/reject', rejectFriendRequest);
router.post('/cancel', cancelFriendRequest);
router.delete('/:friendId', removeFriend);

router.post('/block', blockUser);
router.post('/unblock', unblockUser);
router.get('/', getFriends);
router.get('/requests', getFriendRequests);

router.post('/report', reportUser);

export default router;
