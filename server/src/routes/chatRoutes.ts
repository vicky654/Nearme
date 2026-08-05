import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  getConversations,
  createOrGetConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  toggleMute,
  toggleArchive,
  deleteConversation,
  uploadAttachment,
} from '../controllers/chatController';
import { uploadChatAttachment } from '../middleware/chatUpload';

const router = Router();

router.use(authenticate);

router.get('/', getConversations);
router.post('/', createOrGetConversation);

router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/attachments', uploadChatAttachment.single('attachment'), uploadAttachment);
router.post('/:conversationId/messages', sendMessage);
router.patch('/:conversationId/messages/:messageId', editMessage);
router.delete('/:conversationId/messages/:messageId', deleteMessage);

router.post('/:conversationId/read', markAsRead);
router.post('/:conversationId/mute', toggleMute);
router.post('/:conversationId/archive', toggleArchive);
router.delete('/:conversationId', deleteConversation);

export default router;
