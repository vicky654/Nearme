import { useState } from 'react';
import type { ConversationItem, ChatMessage } from '../../api/chatApi';
import { getUserId } from '../../types/user';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Button } from '../ui/Button';

interface ChatWindowProps {
  conversation: ConversationItem;
  messages: ChatMessage[];
  currentUserId: string;
  isOnline: boolean;
  isTyping: boolean;
  onSendMessage: (content: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onBlockUser: (targetUserId: string) => void;
  onReportUser: (targetUserId: string) => void;
  onBackMobile?: () => void;
}

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  isOnline,
  isTyping,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onTypingStart,
  onTypingStop,
  onBlockUser,
  onReportUser,
  onBackMobile,
}: ChatWindowProps) {
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const recipient = conversation.recipient;

  if (!recipient) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-gray-500">
        User account no longer available.
      </div>
    );
  }

  function handleStartEdit(id: string, content: string) {
    setEditingMessage({ id, content });
  }

  function handleSaveEdit(id: string, newContent: string) {
    onEditMessage(id, newContent);
    setEditingMessage(null);
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {onBackMobile && (
            <button
              type="button"
              onClick={onBackMobile}
              className="mr-1 text-gray-500 hover:text-gray-700 md:hidden dark:text-gray-400"
            >
              ← Back
            </button>
          )}

          <div className="relative">
            <img
              src={recipient.avatarUrl}
              alt={recipient.displayName}
              className="h-10 w-10 rounded-full object-cover"
            />
            {isOnline && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
            )}
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{recipient.displayName}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isOnline ? 'Online' : recipient.lastSeenAt ? `Last seen ${new Date(recipient.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Offline'}
            </p>
          </div>
        </div>

        {/* Action Menu Button */}
        <button
          type="button"
          onClick={() => setShowOptionsModal((prev) => !prev)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          ⚙️ Options
        </button>
      </div>

      {/* Options Dropdown */}
      {showOptionsModal && (
        <div className="absolute right-4 top-16 z-30 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-800 dark:bg-gray-800">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setShowOptionsModal(false);
              onBlockUser(getUserId(recipient));
            }}
          >
            🚫 Block User
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setShowOptionsModal(false);
              onReportUser(getUserId(recipient));
            }}
          >
            🚩 Report User
          </Button>
        </div>
      )}

      {/* Message List */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        onEditMessage={handleStartEdit}
        onDeleteMessage={onDeleteMessage}
        isTyping={isTyping}
        recipientName={recipient.displayName}
      />

      {/* Message Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onSaveEdit={handleSaveEdit}
      />
    </div>
  );
}
