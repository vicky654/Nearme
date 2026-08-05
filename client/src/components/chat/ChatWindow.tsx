import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IonIcon } from '@ionic/react';
import { arrowBackOutline, callOutline, ellipsisVertical, shieldOutline, videocamOutline } from 'ionicons/icons';
import type { ChatAttachment, ConversationItem, ChatMessage } from '../../api/chatApi';
import type { TypingUser } from '../../store/chatStore';
import { getUserId } from '../../types/user';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Button } from '../ui/Button';

interface ChatWindowProps {
  conversation: ConversationItem;
  messages: ChatMessage[];
  currentUserId: string;
  isOnline: boolean;
  typingUser?: TypingUser;
  lastSeenAt?: string | null;
  draft: string;
  onDraftChange: (draft: string) => void;
  isLoadingMessages?: boolean;
  isLoadingOlder?: boolean;
  hasOlderMessages?: boolean;
  onLoadOlderMessages?: () => Promise<void>;
  onSendMessage: (content: string, replyTo?: ChatMessage, attachments?: ChatAttachment[]) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onBlockUser: (targetUserId: string) => void;
  onReportUser: (targetUserId: string) => void;
  onBackMobile?: () => void;
}

function formatPresence(isOnline: boolean, lastSeenAt?: string | null) {
  if (isOnline) return 'Online';
  if (!lastSeenAt) return 'Offline';
  const elapsed = Date.now() - new Date(lastSeenAt).getTime();
  if (elapsed < 60_000) return 'Last seen just now';
  if (elapsed < 3_600_000) return `Last seen ${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `Last seen ${Math.floor(elapsed / 3_600_000)} hr ago`;
  return `Last seen ${new Date(lastSeenAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  isOnline,
  typingUser,
  lastSeenAt,
  draft,
  onDraftChange,
  isLoadingMessages = false,
  isLoadingOlder = false,
  hasOlderMessages = false,
  onLoadOlderMessages,
  onSendMessage,
  onRetryMessage,
  onEditMessage,
  onDeleteMessage,
  onReactMessage,
  onTypingStart,
  onTypingStop,
  onRecordingStart,
  onRecordingStop,
  onBlockUser,
  onReportUser,
  onBackMobile,
}: ChatWindowProps) {
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [, setClock] = useState(0);
  const recipient = conversation.recipient;

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!recipient) {
    return <div className="flex h-full flex-col items-center justify-center p-6 text-gray-500">User account no longer available.</div>;
  }

  const statusText = typingUser
    ? `${typingUser.activity === 'recording' ? 'Recording' : 'Typing'}…`
    : formatPresence(isOnline, lastSeenAt);

  return (
    <motion.section
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="relative flex h-full min-w-0 flex-col overflow-hidden bg-white dark:bg-gray-900"
      aria-label={`Conversation with ${recipient.displayName}`}
    >
      <header className="relative z-30 flex min-h-[72px] items-center justify-between border-b border-gray-200/70 bg-white/90 px-2.5 py-2 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/88 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {onBackMobile && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={onBackMobile}
              aria-label="Back to conversations"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <IonIcon icon={arrowBackOutline} className="text-xl" />
            </motion.button>
          )}

          <motion.div whileHover={{ scale: 1.03 }} className="relative shrink-0">
            <img src={recipient.avatarUrl} alt="" className="h-11 w-11 rounded-[1.05rem] object-cover shadow-sm" />
            {isOnline && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2.4 }}
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-white bg-emerald-500 dark:border-gray-900"
                aria-label="Online"
              />
            )}
          </motion.div>

          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-gray-950 dark:text-gray-50">{recipient.displayName}</h2>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={statusText}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                className={`truncate text-[11px] font-medium ${typingUser ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}
              >
                {statusText}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="ml-2 flex items-center gap-0.5">
          <motion.button whileTap={{ scale: 0.9 }} type="button" aria-label="Voice call" className="grid h-11 w-11 place-items-center rounded-2xl text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10">
            <IonIcon icon={callOutline} className="text-xl" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} type="button" aria-label="Video call" className="hidden h-11 w-11 place-items-center rounded-2xl text-brand-600 hover:bg-brand-50 sm:grid dark:hover:bg-brand-500/10">
            <IonIcon icon={videocamOutline} className="text-xl" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            aria-label="Conversation options"
            aria-expanded={showOptions}
            onClick={() => setShowOptions((value) => !value)}
            className="grid h-11 w-11 place-items-center rounded-2xl text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <IonIcon icon={ellipsisVertical} className="text-xl" />
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="absolute right-3 top-[68px] z-40 w-52 rounded-2xl border border-gray-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95"
          >
            <div className="mb-1 flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <IonIcon icon={shieldOutline} /> Safety
            </div>
            <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => { setShowOptions(false); onBlockUser(getUserId(recipient)); }}>Block user</Button>
            <Button size="sm" variant="ghost" className="w-full justify-start text-coral" onClick={() => { setShowOptions(false); onReportUser(getUserId(recipient)); }}>Report conversation</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        onEditMessage={(messageId, content) => { setReplyingTo(null); setEditingMessage({ id: messageId, content }); }}
        onDeleteMessage={onDeleteMessage}
        onReplyMessage={setReplyingTo}
        onReactMessage={onReactMessage}
        onRetryMessage={onRetryMessage}
        typingUser={typingUser}
        isLoading={isLoadingMessages}
        isLoadingOlder={isLoadingOlder}
        hasOlder={hasOlderMessages}
        onLoadOlder={onLoadOlderMessages}
      />

      <MessageInput
        conversationId={conversation._id}
        draft={draft}
        onDraftChange={onDraftChange}
        onSendMessage={(content, attachments) => { onSendMessage(content, replyingTo || undefined, attachments); setReplyingTo(null); }}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        onRecordingStart={onRecordingStart}
        onRecordingStop={onRecordingStop}
        editingMessage={editingMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditingMessage(null)}
        onSaveEdit={(id, content) => { onEditMessage(id, content); setEditingMessage(null); }}
      />
    </motion.section>
  );
}
