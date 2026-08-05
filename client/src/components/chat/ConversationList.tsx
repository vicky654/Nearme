import { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { searchOutline } from 'ionicons/icons';
import type { ConversationItem } from '../../api/chatApi';
import { getUserId } from '../../types/user';

interface ConversationListProps {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onMuteToggle: (id: string) => void;
  onArchiveToggle: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onlineUsers: Set<string>;
  typingMap: Record<string, { userId: string; displayName: string }[]>;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onMuteToggle,
  onArchiveToggle,
  onDeleteConversation,
  onlineUsers,
  typingMap,
}: ConversationListProps) {
  const [filter, setFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filteredConversations = useMemo(() => conversations.filter((c) => {
    if (!c.recipient) return false;
    const matchesFilter =
      c.recipient.displayName.toLowerCase().includes(filter.toLowerCase()) ||
      c.recipient.username.toLowerCase().includes(filter.toLowerCase());
    const matchesArchive = showArchived ? c.isArchived : !c.isArchived;
    return matchesFilter && matchesArchive;
  }), [conversations, filter, showArchived]);

  return (
    <div className="flex h-full flex-col border-r border-gray-200/70 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div><p className="eyebrow">Stay close</p><h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">Messages</h2></div>
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className="rounded-xl bg-gray-100 px-2.5 py-2 text-[10px] font-bold text-brand-600 dark:bg-gray-800"
          >
            {showArchived ? 'View Active' : 'View Archived'}
          </button>
        </div>
        <div className="relative"><IonIcon icon={searchOutline} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input
          type="text"
          placeholder="Search chats..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="min-h-11 w-full rounded-2xl border-0 bg-gray-100 pl-10 pr-3 text-sm outline-none ring-brand-500/20 focus:ring-4 dark:bg-gray-800 dark:text-gray-100"
        /></div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            {showArchived ? 'No archived chats.' : 'No active chats found.'}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const recipient = conv.recipient!;
            const isActive = activeConversationId === conv._id;
            const isOnline = onlineUsers.has(getUserId(recipient));
            const typingUsers = typingMap[conv._id] || [];
            const isTyping = typingUsers.length > 0;

            return (
              <div
                key={conv._id}
                onClick={() => onSelectConversation(conv._id)}
                className={`group relative mx-2 flex cursor-pointer items-center justify-between gap-3 rounded-2xl p-3 transition-colors ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-500/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <img
                      loading="lazy"
                      decoding="async"
                      src={recipient.avatarUrl}
                      alt={recipient.displayName}
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate dark:text-gray-100">
                        {recipient.displayName}
                      </span>
                      {conv.isMuted && <span className="text-xs text-gray-400">🔇</span>}
                    </div>

                    {isTyping ? (
                      <span className="text-xs font-semibold text-indigo-600 animate-pulse dark:text-indigo-400">
                        typing...
                      </span>
                    ) : conv.lastMessage ? (
                      <span className="text-xs text-gray-500 truncate dark:text-gray-400">
                        {conv.lastMessage.deletedAt ? 'Message deleted' : conv.lastMessage.content}
                      </span>
                    ) : (
                      <span className="text-xs italic text-gray-400">No messages yet</span>
                    )}
                  </div>
                </div>

                {/* Right metadata & unread */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {conv.lastMessageAt && (
                    <span className="text-[11px] text-gray-400">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  {conv.unreadCount > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                      {conv.unreadCount}
                    </span>
                  )}

                  {/* Actions Dropdown / Quick Hover Buttons */}
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      type="button"
                      title={conv.isMuted ? 'Unmute' : 'Mute'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMuteToggle(conv._id);
                      }}
                      className="p-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {conv.isMuted ? '🔔' : '🔇'}
                    </button>
                    <button
                      type="button"
                      title={conv.isArchived ? 'Unarchive' : 'Archive'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchiveToggle(conv._id);
                      }}
                      className="p-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      📦
                    </button>
                    <button
                      type="button"
                      title="Delete Conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv._id);
                      }}
                      className="p-1 text-xs text-red-400 hover:text-red-600"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
