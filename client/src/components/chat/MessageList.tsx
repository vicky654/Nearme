import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage } from '../../api/chatApi';
import { getUserId } from '../../types/user';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  onEditMessage: (messageId: string, currentContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  isTyping: boolean;
  recipientName: string;
  isLoading?: boolean;
  isLoadingOlder?: boolean;
  hasOlder?: boolean;
  onLoadOlder?: () => Promise<void>;
}

export function MessageList({
  messages,
  currentUserId,
  onEditMessage,
  onDeleteMessage,
  isTyping,
  recipientName,
  isLoading = false,
  isLoadingOlder = false,
  hasOlder = false,
  onLoadOlder,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages.at(-1)?._id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastMessageId, isTyping]);

  async function handleScroll() {
    const container = containerRef.current;
    if (!container || container.scrollTop > 80 || !hasOlder || isLoadingOlder || !onLoadOlder) return;
    const previousHeight = container.scrollHeight;
    await onLoadOlder();
    requestAnimationFrame(() => {
      if (containerRef.current) containerRef.current.scrollTop += containerRef.current.scrollHeight - previousHeight;
    });
  }

  return (
    <div ref={containerRef} onScroll={() => void handleScroll()} className="flex-1 space-y-3 overflow-y-auto bg-[#f7f8fc] p-4 dark:bg-gray-950/60 sm:p-6">
      {(isLoading || isLoadingOlder) && <div role="status" aria-label={isLoading ? 'Loading messages' : 'Loading older messages'} className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-gray-400 shadow-sm dark:bg-gray-900"><span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />{isLoading ? 'Loading messages…' : 'Loading earlier messages…'}</div>}
      {messages.length > 0 && <div className="sticky top-2 z-10 mx-auto w-fit rounded-full bg-white/85 px-3 py-1 text-[10px] font-bold text-gray-400 shadow-sm backdrop-blur dark:bg-gray-900/85">Today</div>}
      {messages.map((msg) => {
        const senderIdStr = typeof msg.senderId === 'object' ? getUserId(msg.senderId) : String(msg.senderId);
        const isOwn = senderIdStr === currentUserId.toString();
        const isDeleted = Boolean(msg.deletedAt);

        return (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            key={msg._id}
            className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`group relative max-w-[82%] rounded-[1.25rem] px-4 py-2.5 text-sm shadow-sm sm:max-w-[70%] ${
                isOwn
                  ? 'rounded-br-md bg-brand-600 text-white shadow-brand-500/15'
                  : 'rounded-bl-md border border-gray-200/70 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
              }`}
            >
              {/* Content */}
              <p className={`whitespace-pre-wrap ${isDeleted ? 'italic opacity-70' : ''}`}>
                {msg.content}
              </p>

              {/* Timestamp & Status Ticks */}
              <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                {msg.editedAt && !isDeleted && <span>(edited)</span>}
                <span>
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {isOwn && !isDeleted && (
                  <span className={msg.status === 'seen' ? 'text-cyan-300 font-bold' : ''}>
                    {msg.status === 'seen' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                  </span>
                )}
              </div>

              {/* Message Hover Menu (Edit / Delete for own messages) */}
              {isOwn && !isDeleted && (
                <div className="absolute right-0 top-0 -translate-y-full hidden group-hover:flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 shadow-md">
                  <button
                    type="button"
                    onClick={() => onEditMessage(msg._id, msg.content)}
                    className="text-xs text-gray-600 hover:text-indigo-600 dark:text-gray-300"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMessage(msg._id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}

      {isTyping && (
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" />
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
          </div>
          {recipientName} is typing...
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
