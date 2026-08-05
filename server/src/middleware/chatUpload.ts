import { mkdirSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { env } from '../config/env';

export const chatUploadDirectory = env.CHAT_UPLOAD_DIR
  ? path.resolve(env.CHAT_UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads/chat');
mkdirSync(chatUploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'application/pdf',
  'text/plain',
]);

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

export const uploadChatAttachment = multer({
  storage: multer.diskStorage({
    destination: chatUploadDirectory,
    filename: (_request, file, callback) => {
      callback(null, `${randomUUID()}${extensionByMimeType[file.mimetype] || ''}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (allowedMimeTypes.has(file.mimetype)) callback(null, true);
    else callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'attachment'));
  },
});
