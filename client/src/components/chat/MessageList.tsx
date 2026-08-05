import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IonIcon } from '@ionic/react';
import { checkmark, checkmarkDone, copyOutline, arrowUndoOutline, createOutline, documentOutline, trashOutline, timeOutline, warningOutline } from 'ionicons/icons';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Clipboard } from '@capacitor/clipboard';
import type { ChatAttachment, ChatMessage } from '../../api/chatApi';
import type { TypingUser } from '../../store/chatStore';
import { getUserId } from '../../types/user';
import { Skeleton } from '../ui/Skeleton';

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  onEditMessage: (messageId: string, currentContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onReplyMessage: (message: ChatMessage) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  typingUser?: TypingUser;
  isLoading?: boolean;
  isLoadingOlder?: boolean;
  hasOlder?: boolean;
  onLoadOlder?: () => Promise<void>;
}

const REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];
const FIRST_INDEX = 1_000_000;

function getSenderId(message: ChatMessage) {
  return typeof message.senderId === 'object' ? getUserId(message.senderId) : String(message.senderId);
}

function statusLabel(status: ChatMessage['status']) {
  if (status === 'sending') return 'Sending';
  if (status === 'failed') return 'Not sent';
  if (status === 'sent') return 'Sent';
  if (status === 'delivered') return 'Delivered';
  return 'Read';
}

function StatusIcon({ status }: { status: ChatMessage['status'] }) {
  if (status === 'sending') return <IonIcon icon={timeOutline} className="animate-pulse" />;
  if (status === 'failed') return <IonIcon icon={warningOutline} />;
  if (status === 'sent') return <IonIcon icon={checkmark} />;
  return <IonIcon icon={checkmarkDone} className={status === 'seen' ? 'text-cyan-300' : ''} />;
}

function AttachmentPreview({ attachment, isOwn }: { attachment: ChatAttachment; isOwn: boolean }) {
  const [loaded, setLoaded] = useState(false);
  if (attachment.type === 'image') {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="relative mb-2 block min-h-36 min-w-48 overflow-hidden rounded-2xl bg-gray-200/60 dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
        <div className={`absolute inset-0 bg-gradient-to-br ${isOwn ? 'from-white/20 to-white/5' : 'from-brand-100 to-violet-100 dark:from-gray-800 dark:to-gray-700'} transition-opacity duration-500 ${loaded ? 'opacity-0' : 'animate-pulse opacity-100'}`} />
        <img loading="lazy" decoding="async" src={attachment.url} alt={attachment.name} onLoad={() => setLoaded(true)} className={`max-h-80 w-full object-cover transition duration-500 ${loaded ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-0 blur-md'}`} />
      </a>
    );
  }
  if (attachment.type === 'audio') {
    return <audio controls preload="metadata" src={attachment.url} className="mb-2 h-10 max-w-full" onClick={(event) => event.stopPropagation()} aria-label={attachment.name} />;
  }
  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${isOwn ? 'bg-white/12 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>
      <IonIcon icon={documentOutline} className="text-lg" /><span className="min-w-0 truncate">{attachment.name}</span><span className="shrink-0 text-[9px] opacity-60">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
    </a>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  previousMessage?: ChatMessage;
  currentUserId: string;
  highlighted: boolean;
  onEditMessage: MessageListProps['onEditMessage'];
  onDeleteMessage: MessageListProps['onDeleteMessage'];
  onReplyMessage: MessageListProps['onReplyMessage'];
  onReactMessage: MessageListProps['onReactMessage'];
  onRetryMessage: MessageListProps['onRetryMessage'];
}

const MessageBubble = memo(function MessageBubble({
  message,
  previousMessage,
  currentUserId,
  highlighted,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onReactMessage,
  onRetryMessage,
}: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const senderId = getSenderId(message);
  const isOwn = senderId === currentUserId;
  const isDeleted = Boolean(message.deletedAt);
  const messageDate = new Date(message.createdAt);
  const previousDate = previousMessage ? new Date(previousMessage.createdAt) : null;
  const showDate = !previousDate || previousDate.toDateString() !== messageDate.toDateString();
  const reply = typeof message.replyTo === 'object' ? message.replyTo : undefined;

  const reactionGroups = useMemo(() => {
    const groups = new Map<string, number>();
    message.reactions?.forEach((reaction) => groups.set(reaction.emoji, (groups.get(reaction.emoji) || 0) + 1));
    return [...groups.entries()];
  }, [message.reactions]);

  const startLongPress = () => {
    holdTimer.current = setTimeout(() => {
      setShowMenu(true);
      if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    }, 450);
  };
  const cancelLongPress = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const copyMessage = async () => {
    if (Capacitor.isNativePlatform()) await Clipboard.write({ string: message.content });
    else await navigator.clipboard?.writeText(message.content);
    setShowMenu(false);
  };

  return (
    <div className="px-3 sm:px-5">
      {showDate && (
        <div className="sticky top-2 z-10 mx-auto my-3 w-fit rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-bold text-gray-400 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
          {messageDate.toDateString() === new Date().toDateString()
            ? 'Today'
            : messageDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 430, damping: 32, mass: 0.65 }}
        className={`flex py-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`relative max-w-[86%] sm:max-w-[72%] ${isOwn ? 'items-end' : 'items-start'}`}>
          <motion.div
            onPointerDown={startLongPress}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onContextMenu={(event) => { event.preventDefault(); setShowMenu(true); }}
            onClick={() => message.status === 'failed' && onRetryMessage(message)}
            className={`group relative rounded-[1.25rem] px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-[0_2px_10px_rgba(15,23,42,.06)] transition-shadow hover:shadow-md sm:text-sm ${highlighted && !isOwn ? 'message-highlight' : ''} ${
              isOwn
                ? `rounded-br-[.35rem] text-white ${message.status === 'failed' ? 'cursor-pointer bg-coral' : 'bg-gradient-to-br from-brand-500 to-brand-700'}`
                : 'rounded-bl-[.35rem] border border-gray-200/70 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100'
            }`}
          >
            {reply && (
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                className={`mb-2 block w-full rounded-xl border-l-2 px-2.5 py-1.5 text-left text-[11px] ${isOwn ? 'border-white/70 bg-white/12' : 'border-brand-500 bg-gray-50 dark:bg-gray-800'}`}
              >
                <span className={`block font-bold ${isOwn ? 'text-white/90' : 'text-brand-600 dark:text-brand-400'}`}>
                  {getSenderId(reply as ChatMessage) === currentUserId ? 'You' : typeof reply.senderId === 'object' ? reply.senderId.displayName : 'Message'}
                </span>
                <span className="block truncate opacity-75">{reply.deletedAt ? 'Message deleted' : reply.content}</span>
              </button>
            )}

            {message.attachments?.map((attachment) => <AttachmentPreview key={attachment.url} attachment={attachment} isOwn={isOwn} />)}
            <p className={`whitespace-pre-wrap break-words ${isDeleted ? 'italic opacity-65' : ''}`}>{message.content}</p>

            <div className={`mt-1 flex items-center justify-end gap-1 text-[9.5px] ${isOwn ? 'text-white/65' : 'text-gray-400'}`}>
              {message.editedAt && !isDeleted && <span>edited</span>}
              <time dateTime={message.createdAt}>{messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
              {isOwn && !isDeleted && (
                <span className={`inline-flex items-center gap-0.5 font-semibold ${message.status === 'failed' ? 'text-white' : ''}`} aria-label={statusLabel(message.status)} title={statusLabel(message.status)}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={message.status} initial={{ opacity: 0, scale: 0.65 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.65 }} className="inline-grid"><StatusIcon status={message.status} /></motion.span>
                  </AnimatePresence>
                </span>
              )}
            </div>
          </motion.div>

          {message.status === 'failed' && <p className="mt-1 px-1 text-[10px] font-semibold text-coral">Not sent · tap to retry</p>}

          {reactionGroups.length > 0 && (
            <div className={`relative z-10 -mt-1 flex flex-wrap gap-1 ${isOwn ? 'justify-end pr-2' : 'justify-start pl-2'}`}>
              {reactionGroups.map(([emoji, count]) => (
                <motion.button
                  whileTap={{ scale: 0.82 }}
                  key={emoji}
                  type="button"
                  onClick={() => onReactMessage(message._id, emoji)}
                  className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  aria-label={`${emoji} reaction, ${count}`}
                >
                  {emoji}{count > 1 ? ` ${count}` : ''}
                </motion.button>
              ))}
            </div>
          )}

          <AnimatePresence>
            {showMenu && !isDeleted && message.status !== 'sending' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.86, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 5 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`absolute bottom-[calc(100%+.5rem)] z-30 w-56 rounded-2xl border border-gray-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95 ${isOwn ? 'right-0' : 'left-0'}`}
              >
                <div className="mb-1 flex justify-between gap-1 border-b border-gray-100 pb-2 dark:border-gray-800">
                  {REACTIONS.map((emoji) => (
                    <motion.button key={emoji} whileHover={{ y: -3, scale: 1.12 }} whileTap={{ scale: 0.8 }} type="button" onClick={() => { onReactMessage(message._id, emoji); setShowMenu(false); }} className="grid h-8 w-8 place-items-center rounded-full text-lg hover:bg-gray-100 dark:hover:bg-gray-800">{emoji}</motion.button>
                  ))}
                </div>
                <button type="button" onClick={() => { onReplyMessage(message); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"><IonIcon icon={arrowUndoOutline} /> Reply</button>
                <button type="button" onClick={() => void copyMessage()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"><IonIcon icon={copyOutline} /> Copy</button>
                {isOwn && (
                  <>
                    <button type="button" onClick={() => { onEditMessage(message._id, message.content); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"><IonIcon icon={createOutline} /> Edit</button>
                    <button type="button" onClick={() => { onDeleteMessage(message._id); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-coral hover:bg-coral/10"><IonIcon icon={trashOutline} /> Delete</button>
                  </>
                )}
                <button type="button" onClick={() => setShowMenu(false)} className="mt-1 w-full rounded-xl px-3 py-1.5 text-[10px] font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">Close</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
});

function MessageSkeletons() {
  return (
    <div className="flex h-full flex-col justify-end gap-3 p-4 sm:p-6" role="status" aria-label="Loading messages">
      {[55, 72, 44, 68, 50].map((width, index) => (
        <div key={width} className={index % 2 ? 'flex justify-end' : ''}>
          <div style={{ width: `${width}%` }}><Skeleton className="h-14 rounded-[1.25rem]" /></div>
        </div>
      ))}
    </div>
  );
}

export function MessageList({
  messages,
  currentUserId,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onReactMessage,
  onRetryMessage,
  typingUser,
  isLoading = false,
  isLoadingOlder = false,
  hasOlder = false,
  onLoadOlder,
}: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const isAtBottomRef = useRef(true);
  const previousLastId = useRef<string | null>(null);
  const firstIdRef = useRef<string | null>(null);
  const firstItemIndexRef = useRef(FIRST_INDEX);
  const highlightTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const [newMessageCount, setNewMessageCount] = useState(0);

  const firstId = messages[0]?._id || null;
  if (!firstIdRef.current && firstId) firstIdRef.current = firstId;
  else if (firstId && firstIdRef.current !== firstId) {
    const previousFirstIndex = messages.findIndex((message) => message._id === firstIdRef.current);
    if (previousFirstIndex > 0) firstItemIndexRef.current -= previousFirstIndex;
    firstIdRef.current = firstId;
  }

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (!lastMessage) return;
    const oldLastId = previousLastId.current;
    previousLastId.current = lastMessage._id;
    if (!oldLastId || oldLastId === lastMessage._id) return;
    const oldLastIndex = messages.findIndex((message) => message._id === oldLastId);
    const appended = oldLastIndex >= 0 ? messages.slice(oldLastIndex + 1) : [lastMessage];
    const incoming = appended.filter((message) => getSenderId(message) !== currentUserId);
    if (incoming.length === 0) return;

    setHighlightedIds((current) => new Set([...current, ...incoming.map((message) => message._id)]));
    incoming.forEach((message) => {
      const existing = highlightTimers.current.get(message._id);
      if (existing) clearTimeout(existing);
      highlightTimers.current.set(message._id, setTimeout(() => {
        setHighlightedIds((current) => {
          const next = new Set(current);
          next.delete(message._id);
          return next;
        });
        highlightTimers.current.delete(message._id);
      }, 700));
    });
    if (!isAtBottomRef.current) setNewMessageCount((count) => count + incoming.length);
  }, [currentUserId, messages]);

  useEffect(() => () => {
    highlightTimers.current.forEach(clearTimeout);
  }, []);

  if (isLoading && messages.length === 0) return <div className="min-h-0 flex-1 bg-[#f5f7fb] dark:bg-gray-950"><MessageSkeletons /></div>;

  if (!isLoading && messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gradient-to-b from-[#f7f9fc] to-brand-50/40 p-8 text-center dark:from-gray-950 dark:to-brand-950/20">
        <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3.5 }} className="mb-4 grid h-20 w-20 place-items-center rounded-[1.75rem] bg-white text-3xl shadow-xl shadow-brand-500/10 dark:bg-gray-900">💬</motion.div>
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Start something good</h3>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-400">Send a message, share an idea, or simply say hello.</p>
      </div>
    );
  }

  const absoluteLastIndex = firstItemIndexRef.current + messages.length - 1;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#f5f7fb] dark:bg-gray-950">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,rgba(99,102,241,.12)_1px,transparent_0)] [background-size:22px_22px] dark:opacity-15" />
      <Virtuoso
        ref={virtuosoRef}
        className="chat-message-scroller"
        style={{ height: '100%' }}
        data={messages}
        firstItemIndex={firstItemIndexRef.current}
        initialTopMostItemIndex={{ index: absoluteLastIndex, align: 'end' }}
        computeItemKey={(_, message) => message._id}
        defaultItemHeight={72}
        increaseViewportBy={{ top: 320, bottom: 240 }}
        followOutput={(isAtBottom) => isAtBottom ? (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth') : false}
        atBottomThreshold={80}
        atBottomStateChange={(isAtBottom) => {
          isAtBottomRef.current = isAtBottom;
          if (isAtBottom) setNewMessageCount(0);
        }}
        startReached={() => {
          if (hasOlder && !isLoadingOlder && onLoadOlder) void onLoadOlder();
        }}
        itemContent={(index, message) => {
          const dataIndex = index - firstItemIndexRef.current;
          return (
            <MessageBubble
              message={message}
              previousMessage={messages[dataIndex - 1]}
              currentUserId={currentUserId}
              highlighted={highlightedIds.has(message._id)}
              onEditMessage={onEditMessage}
              onDeleteMessage={onDeleteMessage}
              onReplyMessage={onReplyMessage}
              onReactMessage={onReactMessage}
              onRetryMessage={onRetryMessage}
            />
          );
        }}
        components={{
          Header: () => (
            <div className="relative z-10 flex min-h-10 items-center justify-center py-2">
              {isLoadingOlder ? (
                <div className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold text-gray-400 shadow-sm dark:bg-gray-900"><span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />Loading earlier messages…</div>
              ) : hasOlder ? <span className="text-[10px] font-semibold text-gray-400">Scroll up for earlier messages</span> : <span className="text-[10px] font-semibold text-gray-300">Beginning of conversation</span>}
            </div>
          ),
          Footer: () => typingUser ? (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-4 py-3 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-white px-3 py-2 shadow-sm dark:bg-gray-900">
                {[0, 1, 2].map((index) => <motion.span key={index} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: index * 0.14 }} className="h-1.5 w-1.5 rounded-full bg-brand-500" />)}
              </div>
              {typingUser.displayName} is {typingUser.activity === 'recording' ? 'recording' : 'typing'}…
            </motion.div>
          ) : <div className="h-2" />,
        }}
      />

      <AnimatePresence>
        {newMessageCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => virtuosoRef.current?.scrollToIndex({ index: absoluteLastIndex, align: 'end', behavior: 'smooth' })}
            className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-gray-950 px-4 py-2 text-xs font-bold text-white shadow-2xl shadow-gray-950/30 dark:bg-white dark:text-gray-900"
          >
            ↓ New {newMessageCount === 1 ? 'message' : `messages (${newMessageCount})`}
          </motion.button>
        )}
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">{newMessageCount > 0 ? `${newMessageCount} new messages` : ''}</span>
    </div>
  );
}
