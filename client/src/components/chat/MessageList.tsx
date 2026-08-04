import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../api/chatApi';
import { getUserId } from '../../types/user';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  onEditMessage: (messageId: string, currentContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  isTyping: boolean;
  recipientName: string;
}

export function MessageList({
  messages,
  currentUserId,
  onEditMessage,
  onDeleteMessage,
  isTyping,
  recipientName,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-950/40">
      {messages.map((msg) => {
        const senderIdStr = typeof msg.senderId === 'object' ? getUserId(msg.senderId) : String(msg.senderId);
        const isOwn = senderIdStr === currentUserId.toString();
        const isDeleted = Boolean(msg.deletedAt);

        return (
          <div
            key={msg._id}
            className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`group relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                isOwn
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
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
          </div>
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
