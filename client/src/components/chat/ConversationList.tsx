import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/react';
import { archiveOutline, chatbubbleEllipsesOutline, searchOutline, trashOutline, volumeHighOutline, volumeMuteOutline } from 'ionicons/icons';
import type { ConversationItem } from '../../api/chatApi';
import type { TypingUser } from '../../store/chatStore';
import { getUserId } from '../../types/user';
import { Skeleton } from '../ui/Skeleton';

interface ConversationListProps {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onMuteToggle: (id: string) => void;
  onArchiveToggle: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRefresh: () => Promise<unknown>;
  isLoading: boolean;
  onlineUsers: Set<string>;
  typingMap: Record<string, TypingUser[]>;
}

function formatConversationTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationSkeletons() {
  return <div className="space-y-2 px-3 py-2" role="status" aria-label="Loading conversations">{Array.from({ length: 7 }, (_, index) => <div key={index} className="flex items-center gap-3 rounded-2xl p-2"><Skeleton className="h-13 w-13 shrink-0 rounded-2xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-4/5" /></div></div>)}</div>;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onMuteToggle,
  onArchiveToggle,
  onDeleteConversation,
  onRefresh,
  isLoading,
  onlineUsers,
  typingMap,
}: ConversationListProps) {
  const [filter, setFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [, setClock] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredConversations = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (conversation.isArchived !== showArchived || !conversation.recipient) return false;
      if (!normalized) return true;
      return `${conversation.recipient.displayName} ${conversation.recipient.username} ${conversation.lastMessage?.content || ''}`.toLowerCase().includes(normalized);
    });
  }, [conversations, filter, showArchived]);

  return (
    <IonContent className="h-full [--background:#fff] dark:[--background:#111827]" scrollY>
      <IonRefresher slot="fixed" pullFactor={0.65} pullMin={70} pullMax={130} onIonRefresh={(event) => { void onRefresh().finally(() => event.detail.complete()); }}>
        <IonRefresherContent pullingText="Pull to refresh chats" refreshingSpinner="crescent" refreshingText="Updating conversations…" />
      </IonRefresher>

      <div className="sticky top-0 z-20 border-b border-gray-200/70 bg-white/92 px-3 pb-3 pt-[max(.75rem,var(--sat))] backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/92">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-brand-500">NearMe chat</p>
            <h1 className="text-xl font-black tracking-tight text-gray-950 dark:text-gray-50">Messages</h1>
          </div>
          <motion.button whileTap={{ scale: 0.94 }} type="button" onClick={() => setShowArchived((value) => !value)} className="rounded-xl bg-gray-100 px-3 py-2 text-[10px] font-bold text-brand-600 dark:bg-gray-800 dark:text-brand-400">
            {showArchived ? 'Active chats' : 'Archived'}
          </motion.button>
        </div>
        <label className="relative block">
          <IonIcon icon={searchOutline} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="search" placeholder="Search conversations" value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-11 w-full rounded-2xl border-0 bg-gray-100 pl-10 pr-3 text-sm outline-none ring-brand-500/20 transition focus:ring-4 dark:bg-gray-800 dark:text-gray-100" />
        </label>
      </div>

      {isLoading && conversations.length === 0 ? <ConversationSkeletons /> : filteredConversations.length === 0 ? (
        <div className="flex min-h-[55vh] flex-col items-center justify-center px-8 text-center">
          <motion.div animate={{ rotate: [0, -4, 4, 0], y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="mb-4 grid h-20 w-20 place-items-center rounded-[1.75rem] bg-brand-50 text-3xl text-brand-600 shadow-xl shadow-brand-500/10 dark:bg-brand-500/10"><IonIcon icon={chatbubbleEllipsesOutline} /></motion.div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100">{filter ? 'No matching chats' : showArchived ? 'No archived chats' : 'No conversations yet'}</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">{filter ? 'Try another name or message.' : 'Start a private chat from your friends list.'}</p>
        </div>
      ) : (
        <motion.div layout className="space-y-1 px-2 py-2">
          <AnimatePresence initial={false}>
            {filteredConversations.map((conversation) => {
              const recipient = conversation.recipient!;
              const isActive = activeConversationId === conversation._id;
              const isOnline = onlineUsers.has(getUserId(recipient));
              const typingUser = typingMap[conversation._id]?.[0];
              return (
                <motion.div
                  layout="position"
                  key={conversation._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className={`group relative overflow-hidden rounded-2xl transition-colors ${isActive ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/55'}`}
                >
                  <button type="button" onClick={() => onSelectConversation(conversation._id)} className="flex min-h-[76px] w-full items-center gap-3 px-3 py-2.5 pr-12 text-left" aria-current={isActive ? 'page' : undefined}>
                    <motion.div whileHover={{ scale: 1.04 }} className="relative shrink-0">
                      <img loading="lazy" decoding="async" src={recipient.avatarUrl} alt="" className="h-13 w-13 rounded-[1.1rem] object-cover shadow-sm" />
                      {isOnline && <motion.span animate={{ scale: [1, 1.16, 1] }} transition={{ repeat: Infinity, duration: 2.5 }} className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-white bg-emerald-500 dark:border-gray-900" aria-label="Online" />}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${conversation.unreadCount ? 'font-black text-gray-950 dark:text-white' : 'font-bold text-gray-800 dark:text-gray-100'}`}>{recipient.displayName}</span>
                        <time className={`shrink-0 text-[10px] ${conversation.unreadCount ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-gray-400'}`}>{formatConversationTime(conversation.lastMessageAt)}</time>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span key={typingUser ? 'typing' : conversation.lastMessage?._id || 'empty'} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} className={`min-w-0 truncate text-xs ${typingUser ? 'font-bold text-brand-600 dark:text-brand-400' : conversation.unreadCount ? 'font-semibold text-gray-700 dark:text-gray-200' : 'text-gray-400'}`}>
                            {typingUser ? `${typingUser.activity === 'recording' ? 'Recording' : 'Typing'}…` : conversation.lastMessage?.deletedAt ? 'Message deleted' : conversation.lastMessage?.content || 'Start the conversation'}
                          </motion.span>
                        </AnimatePresence>
                        {conversation.unreadCount > 0 && <motion.span initial={{ scale: 0 }} animate={{ scale: [1, 1.12, 1] }} className="grid min-w-5 shrink-0 place-items-center rounded-full bg-brand-600 px-1.5 text-[10px] font-black leading-5 text-white shadow-md shadow-brand-500/20">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</motion.span>}
                      </div>
                    </div>
                  </button>

                  <div className="absolute right-1.5 top-1.5 flex translate-x-12 flex-col gap-0.5 rounded-xl bg-white/92 p-0.5 opacity-0 shadow-lg backdrop-blur transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100 dark:bg-gray-800/92">
                    <button type="button" title={conversation.isMuted ? 'Unmute' : 'Mute'} onClick={() => onMuteToggle(conversation._id)} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-700"><IonIcon icon={conversation.isMuted ? volumeHighOutline : volumeMuteOutline} /></button>
                    <button type="button" title={conversation.isArchived ? 'Unarchive' : 'Archive'} onClick={() => onArchiveToggle(conversation._id)} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-700"><IonIcon icon={archiveOutline} /></button>
                    <button type="button" title="Delete conversation" onClick={() => onDeleteConversation(conversation._id)} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-coral/10 hover:text-coral"><IonIcon icon={trashOutline} /></button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </IonContent>
  );
}
