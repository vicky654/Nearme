import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  getConversations,
  getMessages,
  editMessage,
  deleteMessage,
  markAsRead,
  toggleMute,
  toggleArchive,
  deleteConversation,
  type ChatMessage,
  type ChatAttachment,
} from '../api/chatApi';
import { blockUser, reportUser } from '../api/friendApi';
import { connectSocket } from '../api/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore, type TypingUser } from '../store/chatStore';
import { getUserId } from '../types/user';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../store/toastStore';
import { getFriendlyApiError } from '../api/errors';
import { playNotificationSound } from '../utils/soundService';

interface ConversationUpdate {
  conversationId: string;
  message: ChatMessage;
  unreadDelta?: number;
}

function impact(style: ImpactStyle) {
  if (Capacitor.isNativePlatform()) void Haptics.impact({ style }).catch(() => undefined);
}

export default function ChatPage() {
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser ? getUserId(currentUser) : '';
  const queryClient = useQueryClient();
  const incomingQueue = useRef<Array<{ conversationId: string; message: ChatMessage }>>([]);
  const queueFrame = useRef<number | null>(null);

  const {
    activeConversationId,
    visibleConversationId,
    setActiveConversationId,
    setVisibleConversationId,
    conversations,
    setConversations,
    updateConversation,
    updateConversationFromMessage,
    messagesMap,
    setMessages,
    addMessage,
    addMessages,
    reconcileMessage,
    updateMessage,
    updateMessagesStatus,
    deleteMessageInStore,
    typingMap,
    setTyping,
    removeTyping,
    onlineUsers,
    lastSeenMap,
    setUserPresence,
    drafts,
    setDraft,
  } = useChatStore();

  const [mobileView, setMobileView] = useState<'list' | 'chat'>(activeConversationId ? 'chat' : 'list');
  const [isPageVisible, setIsPageVisible] = useState(() => document.visibilityState !== 'hidden');

  useEffect(() => {
    const handleVisibility = () => setIsPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const navState = location.state as { conversationId?: string } | null;
    if (!navState?.conversationId) return;
    setActiveConversationId(navState.conversationId);
    setMobileView('chat');
  }, [location.state, setActiveConversationId]);

  useEffect(() => {
    setVisibleConversationId(mobileView === 'chat' && isPageVisible ? activeConversationId : null);
    return () => setVisibleConversationId(null);
  }, [activeConversationId, isPageVisible, mobileView, setVisibleConversationId]);

  const convQuery = useQuery({ queryKey: ['conversations'], queryFn: getConversations });

  useEffect(() => {
    if (convQuery.data?.conversations) setConversations(convQuery.data.conversations);
  }, [convQuery.data, setConversations]);

  const messagesQuery = useInfiniteQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: ({ pageParam }) => getMessages(activeConversationId!, pageParam),
    enabled: Boolean(activeConversationId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.messages.length === 30 ? lastPage.messages[0]?.createdAt : undefined,
  });

  useEffect(() => {
    if (!activeConversationId || !messagesQuery.data?.pages) return;
    const fetched = [...messagesQuery.data.pages].reverse().flatMap((page) => page.messages);
    const existing = useChatStore.getState().messagesMap[activeConversationId] || [];
    const unique = new Map([...fetched, ...existing].map((message) => [message._id, message]));
    setMessages(
      activeConversationId,
      [...unique.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    );
  }, [activeConversationId, messagesQuery.data, setMessages]);

  const activeMessages = activeConversationId ? messagesMap[activeConversationId] || [] : [];
  const lastIncomingId = [...activeMessages].reverse().find((message) => {
    const senderId = typeof message.senderId === 'string' ? message.senderId : getUserId(message.senderId);
    return senderId !== currentUserId;
  })?._id;

  useEffect(() => {
    if (!visibleConversationId || visibleConversationId !== activeConversationId) return;
    updateConversation(visibleConversationId, { unreadCount: 0 });
    const socket = connectSocket();
    socket.emit('message:read', { conversationId: visibleConversationId });
    void markAsRead(visibleConversationId).catch(() => undefined);
  }, [activeConversationId, currentUserId, lastIncomingId, updateConversation, visibleConversationId]);

  useEffect(() => {
    const socket = connectSocket();

    const handlePresence = ({ userId, isOnline, lastSeenAt }: { userId: string; isOnline: boolean; lastSeenAt?: string }) => {
      setUserPresence(userId, isOnline, lastSeenAt);
    };
    const handlePresenceSnapshot = ({ users }: { users: Array<{ userId: string; isOnline: boolean; lastSeenAt?: string }> }) => {
      users.forEach((user) => setUserPresence(user.userId, user.isOnline, user.lastSeenAt));
    };
    const flushIncoming = () => {
      const pending = incomingQueue.current.splice(0);
      queueFrame.current = null;
      const grouped = new Map<string, ChatMessage[]>();
      pending.forEach(({ conversationId, message }) => {
        grouped.set(conversationId, [...(grouped.get(conversationId) || []), message]);
      });
      grouped.forEach((messages, conversationId) => addMessages(conversationId, messages));
    };
    const handleNewMessage = ({ message, conversationId }: { message: ChatMessage; conversationId: string }) => {
      incomingQueue.current.push({ message, conversationId });
      if (queueFrame.current === null) queueFrame.current = requestAnimationFrame(flushIncoming);
    };
    const handleConversationUpdate = ({ conversationId, message, unreadDelta = 0 }: ConversationUpdate) => {
      updateConversationFromMessage(conversationId, message, unreadDelta);
    };
    const handleMessageUpdated = ({ conversationId, message }: { conversationId: string; message: ChatMessage }) => {
      reconcileMessage(conversationId, message);
      const conversation = useChatStore.getState().conversations.find((candidate) => candidate._id === conversationId);
      if (conversation?.lastMessage?._id === message._id) updateConversationFromMessage(conversationId, message, 0);
    };
    const handleStatusUpdate = ({ conversationId, status }: { conversationId: string; status: ChatMessage['status'] }) => {
      const shouldAdvance = (useChatStore.getState().messagesMap[conversationId] || []).some((message) => {
        const senderId = typeof message.senderId === 'string' ? message.senderId : getUserId(message.senderId);
        if (senderId !== currentUserId) return false;
        if (status === 'seen') return message.status !== 'seen';
        if (status === 'delivered') return message.status === 'sent';
        return false;
      });
      updateMessagesStatus(conversationId, status, currentUserId);
      if (shouldAdvance && conversationId === useChatStore.getState().visibleConversationId && document.visibilityState !== 'hidden') {
        if (status === 'delivered') playNotificationSound('delivered');
        if (status === 'seen') playNotificationSound('read');
      }
    };
    const handleTypingStart = ({ conversationId, userId, displayName, activity }: TypingUser & { conversationId: string }) => {
      if (userId !== currentUserId) setTyping(conversationId, { userId, displayName, activity });
    };
    const handleTypingStop = ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      removeTyping(conversationId, userId);
    };

    socket.on('presence:update', handlePresence);
    socket.on('presence:snapshot', handlePresenceSnapshot);
    socket.on('message:new', handleNewMessage);
    socket.on('conversation:updated', handleConversationUpdate);
    socket.on('message:updated', handleMessageUpdated);
    socket.on('message:status_update', handleStatusUpdate);
    socket.on('typing:user_start', handleTypingStart);
    socket.on('typing:user_stop', handleTypingStop);
    socket.emit('presence:get');

    return () => {
      socket.off('presence:update', handlePresence);
      socket.off('presence:snapshot', handlePresenceSnapshot);
      socket.off('message:new', handleNewMessage);
      socket.off('conversation:updated', handleConversationUpdate);
      socket.off('message:updated', handleMessageUpdated);
      socket.off('message:status_update', handleStatusUpdate);
      socket.off('typing:user_start', handleTypingStart);
      socket.off('typing:user_stop', handleTypingStop);
      if (queueFrame.current !== null) cancelAnimationFrame(queueFrame.current);
    };
  }, [addMessages, currentUserId, reconcileMessage, removeTyping, setTyping, setUserPresence, updateConversationFromMessage, updateMessagesStatus]);

  useEffect(() => {
    const socket = connectSocket();
    if (visibleConversationId) socket.emit('chat:join', visibleConversationId);
    return () => {
      if (visibleConversationId) socket.emit('chat:leave', visibleConversationId);
    };
  }, [visibleConversationId]);

  const sendMessage = useCallback((content: string, replyTo?: ChatMessage, attachments: ChatAttachment[] = [], retry?: ChatMessage) => {
    if (!activeConversationId || !currentUser) return;
    const clientId = retry?.clientId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const tempId = retry?._id || `temp-${clientId}`;
    const optimisticMessage: ChatMessage = {
      ...(retry || {}),
      _id: tempId,
      clientId,
      conversationId: activeConversationId,
      senderId: currentUser,
      content,
      status: 'sending',
      readBy: [currentUserId],
      replyTo: replyTo ? {
        _id: replyTo._id,
        senderId: replyTo.senderId,
        content: replyTo.content,
        deletedAt: replyTo.deletedAt,
      } : retry?.replyTo,
      reactions: retry?.reactions || [],
      attachments: retry?.attachments || attachments,
      createdAt: retry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (retry) updateMessage(activeConversationId, tempId, { status: 'sending' });
    else addMessage(activeConversationId, optimisticMessage);
    updateConversationFromMessage(activeConversationId, optimisticMessage, 0);
    impact(ImpactStyle.Light);

    const socket = connectSocket();
    socket.timeout(10_000).emit(
      'message:send',
      {
        conversationId: activeConversationId,
        content,
        clientId,
        replyToId: typeof optimisticMessage.replyTo === 'object' ? optimisticMessage.replyTo._id : undefined,
        attachments: optimisticMessage.attachments,
      },
      (error: Error | null, response: { success?: boolean; message?: ChatMessage; error?: string }) => {
        if (!error && response?.success && response.message) {
          reconcileMessage(activeConversationId, response.message);
          updateConversationFromMessage(activeConversationId, response.message, 0);
          playNotificationSound('outgoing');
          return;
        }
        updateMessage(activeConversationId, tempId, { status: 'failed' });
        toast.error(response?.error || 'Message wasn’t sent. Tap it to retry.');
      }
    );
  }, [activeConversationId, addMessage, currentUser, currentUserId, reconcileMessage, updateConversationFromMessage, updateMessage]);

  function handleSelectConversation(id: string) {
    setActiveConversationId(id);
    setMobileView('chat');
    updateConversation(id, { unreadCount: 0 });
    impact(ImpactStyle.Light);
  }

  function handleEditMessage(messageId: string, newContent: string) {
    if (!activeConversationId) return;
    editMessage(activeConversationId, messageId, newContent)
      .then(({ message }) => updateMessage(activeConversationId, messageId, message))
      .catch((error) => toast.error(getFriendlyApiError(error, 'Unable to edit this message.').message));
  }

  function handleDeleteMessage(messageId: string) {
    if (!activeConversationId) return;
    impact(ImpactStyle.Medium);
    deleteMessage(activeConversationId, messageId)
      .then(() => deleteMessageInStore(activeConversationId, messageId))
      .catch((error) => toast.error(getFriendlyApiError(error, 'Unable to delete this message.').message));
  }

  function handleReactMessage(messageId: string, emoji: string) {
    if (!activeConversationId) return;
    impact(ImpactStyle.Light);
    connectSocket().timeout(8_000).emit(
      'message:react',
      { conversationId: activeConversationId, messageId, emoji },
      (error: Error | null, response: { success?: boolean; message?: ChatMessage; error?: string }) => {
        if (!error && response?.success && response.message) updateMessage(activeConversationId, messageId, response.message);
        else toast.error(response?.error || 'Unable to add reaction.');
      }
    );
  }

  function handleTypingStart() {
    if (visibleConversationId) connectSocket().emit('typing:start', visibleConversationId);
  }

  function handleTypingStop() {
    if (visibleConversationId) connectSocket().emit('typing:stop', visibleConversationId);
  }

  function handleRecordingStart() {
    if (visibleConversationId) connectSocket().emit('recording:start', visibleConversationId);
  }

  function handleRecordingStop() {
    if (visibleConversationId) connectSocket().emit('recording:stop', visibleConversationId);
  }

  function handleMuteToggle(id: string) {
    toggleMute(id).then(({ isMuted }) => {
      updateConversation(id, { isMuted });
      toast.success(isMuted ? 'Chat muted' : 'Chat unmuted');
    }).catch((error) => toast.error(getFriendlyApiError(error, 'Unable to update this chat.').message));
  }

  function handleArchiveToggle(id: string) {
    toggleArchive(id).then(({ isArchived }) => {
      updateConversation(id, { isArchived });
      toast.success(isArchived ? 'Chat archived' : 'Chat unarchived');
    }).catch((error) => toast.error(getFriendlyApiError(error, 'Unable to update this chat.').message));
  }

  function handleDeleteConversation(id: string) {
    deleteConversation(id).then(() => {
      setConversations(conversations.filter((conversation) => conversation._id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMobileView('list');
      }
      toast.success('Conversation deleted');
    }).catch((error) => toast.error(getFriendlyApiError(error, 'Unable to delete this conversation.').message));
  }

  function handleBlock(targetUserId: string) {
    blockUser(targetUserId).then(() => {
      toast.success('User blocked');
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversationId(null);
      setMobileView('list');
    }).catch((error) => toast.error(getFriendlyApiError(error, 'Unable to block this user.').message));
  }

  function handleReport(targetUserId: string) {
    reportUser(targetUserId, 'Inappropriate Chat')
      .then(() => toast.success('User reported'))
      .catch((error) => toast.error(getFriendlyApiError(error, 'Unable to submit your report.').message));
  }

  const activeConversation = conversations.find((conversation) => conversation._id === activeConversationId);
  const recipient = activeConversation?.recipient;
  const recipientId = recipient ? getUserId(recipient) : '';
  const isOnline = Boolean(recipientId && onlineUsers.has(recipientId));
  const typingUser = activeConversationId ? (typingMap[activeConversationId] || [])[0] : undefined;
  const lastSeenAt = recipientId ? lastSeenMap[recipientId] || recipient?.lastSeenAt : recipient?.lastSeenAt;

  return (
    <div className="mx-auto h-full w-full max-w-7xl overflow-hidden md:p-4">
      <div className="flex h-full w-full overflow-hidden bg-white md:rounded-[2rem] md:border md:border-gray-200/70 md:shadow-card dark:bg-gray-900 md:dark:border-gray-800">
        <div className={`h-full w-full flex-shrink-0 md:block md:w-80 lg:w-96 ${mobileView === 'chat' ? 'hidden' : 'block'}`}>
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onMuteToggle={handleMuteToggle}
            onArchiveToggle={handleArchiveToggle}
            onDeleteConversation={handleDeleteConversation}
            onRefresh={async () => { await convQuery.refetch(); }}
            isLoading={convQuery.isPending}
            onlineUsers={onlineUsers}
            typingMap={typingMap}
          />
        </div>

        <div className={`h-full min-w-0 flex-1 md:block ${mobileView === 'list' ? 'hidden' : 'block'}`}>
          {activeConversation ? (
            <ChatWindow
              key={activeConversation._id}
              conversation={activeConversation}
              messages={activeMessages}
              currentUserId={currentUserId}
              isOnline={isOnline}
              typingUser={typingUser}
              lastSeenAt={lastSeenAt}
              draft={drafts[activeConversation._id] || ''}
              onDraftChange={(draft) => setDraft(activeConversation._id, draft)}
              isLoadingMessages={messagesQuery.isPending}
              isLoadingOlder={messagesQuery.isFetchingNextPage}
              hasOlderMessages={messagesQuery.hasNextPage}
              onLoadOlderMessages={() => messagesQuery.fetchNextPage().then(() => undefined)}
              onSendMessage={sendMessage}
              onRetryMessage={(message) => sendMessage(
                message.content,
                typeof message.replyTo === 'object' ? message.replyTo as ChatMessage : undefined,
                message.attachments || [],
                message
              )}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onReactMessage={handleReactMessage}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              onRecordingStart={handleRecordingStart}
              onRecordingStop={handleRecordingStop}
              onBlockUser={handleBlock}
              onReportUser={handleReport}
              onBackMobile={() => setMobileView('list')}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50/70 via-white to-violet-50/60 p-6 dark:from-gray-950 dark:via-gray-900 dark:to-brand-950/30">
              <EmptyState
                title="Your conversations live here"
                description="Choose a chat or start a private conversation with one of your friends."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
