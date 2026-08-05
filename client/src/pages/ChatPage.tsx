import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversations, getMessages, editMessage, deleteMessage, markAsRead, toggleMute, toggleArchive, deleteConversation, ChatMessage } from '../api/chatApi';
import { blockUser, reportUser } from '../api/friendApi';
import { connectSocket } from '../api/socket';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { getUserId } from '../types/user';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../store/toastStore';

export default function ChatPage() {
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const {
    activeConversationId,
    setActiveConversationId,
    conversations,
    setConversations,
    updateConversation,
    messagesMap,
    setMessages,
    addMessage,
    updateMessage,
    deleteMessageInStore,
    typingMap,
    setTyping,
    removeTyping,
    onlineUsers,
    setUserOnline,
  } = useChatStore();

  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Check state navigation (e.g. from NearbyPage or FriendsPage)
  useEffect(() => {
    const navState = location.state as { conversationId?: string } | null;
    if (navState?.conversationId) {
      setActiveConversationId(navState.conversationId);
      setMobileView('chat');
    }
  }, [location.state, setActiveConversationId]);

  // Fetch Conversations
  const convQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
  });

  useEffect(() => {
    if (convQuery.data?.conversations) {
      setConversations(convQuery.data.conversations);
    }
  }, [convQuery.data, setConversations]);

  // Active Conversation Messages Query
  const messagesQuery = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () => getMessages(activeConversationId!),
    enabled: Boolean(activeConversationId),
  });

  useEffect(() => {
    if (activeConversationId && messagesQuery.data?.messages) {
      setMessages(activeConversationId, messagesQuery.data.messages);
      markAsRead(activeConversationId);
    }
  }, [activeConversationId, messagesQuery.data, setMessages]);

  // Socket.IO Setup & Event Listeners
  useEffect(() => {
    const socket = connectSocket();

    socket.on('presence:update', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setUserOnline(userId, isOnline);
    });

    socket.on('message:new', ({ message, conversationId }: { message: ChatMessage; conversationId: string }) => {
      addMessage(conversationId, message);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    socket.on('message:status_update', ({ conversationId }: { conversationId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    });

    socket.on('typing:user_start', ({ conversationId, userId, displayName }: { conversationId: string; userId: string; displayName: string }) => {
      setTyping(conversationId, { userId, displayName });
    });

    socket.on('typing:user_stop', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      removeTyping(conversationId, userId);
    });

    return () => {
      socket.off('presence:update');
      socket.off('message:new');
      socket.off('message:status_update');
      socket.off('typing:user_start');
      socket.off('typing:user_stop');
    };
  }, [addMessage, queryClient, removeTyping, setTyping, setUserOnline]);

  // Join/leave socket room on active conversation change
  useEffect(() => {
    const socket = connectSocket();
    if (activeConversationId) {
      socket.emit('chat:join', activeConversationId);
    }
    return () => {
      if (activeConversationId) {
        socket.emit('chat:leave', activeConversationId);
      }
    };
  }, [activeConversationId]);

  // Handlers
  function handleSelectConversation(id: string) {
    setActiveConversationId(id);
    setMobileView('chat');
  }

  function handleSendMessage(content: string) {
    if (!activeConversationId) return;

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optMsg: ChatMessage = {
      _id: tempId,
      conversationId: activeConversationId,
      senderId: currentUser!,
      content,
      status: 'sent',
      readBy: [getUserId(currentUser!)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addMessage(activeConversationId, optMsg);

    const socket = connectSocket();
    socket.emit('message:send', { conversationId: activeConversationId, content }, (res: any) => {
      if (res?.success && res.message) {
        addMessage(activeConversationId, res.message);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    });
  }

  function handleEditMessage(messageId: string, newContent: string) {
    if (!activeConversationId) return;
    editMessage(activeConversationId, messageId, newContent).then(({ message }) => {
      updateMessage(activeConversationId, messageId, message);
    });
  }

  function handleDeleteMessage(messageId: string) {
    if (!activeConversationId) return;
    deleteMessage(activeConversationId, messageId).then(() => {
      deleteMessageInStore(activeConversationId, messageId);
    });
  }

  function handleTypingStart() {
    if (!activeConversationId) return;
    const socket = connectSocket();
    socket.emit('typing:start', activeConversationId);
  }

  function handleTypingStop() {
    if (!activeConversationId) return;
    const socket = connectSocket();
    socket.emit('typing:stop', activeConversationId);
  }

  function handleMuteToggle(id: string) {
    toggleMute(id).then(({ isMuted }) => {
      updateConversation(id, { isMuted });
      toast.success(isMuted ? 'Chat muted' : 'Chat unmuted');
    });
  }

  function handleArchiveToggle(id: string) {
    toggleArchive(id).then(({ isArchived }) => {
      updateConversation(id, { isArchived });
      toast.success(isArchived ? 'Chat archived' : 'Chat unarchived');
    });
  }

  function handleDeleteConv(id: string) {
    deleteConversation(id).then(() => {
      setConversations(conversations.filter((c) => c._id !== id));
      if (activeConversationId === id) setActiveConversationId(null);
      toast.success('Conversation deleted');
    });
  }

  function handleBlock(targetUserId: string) {
    blockUser(targetUserId).then(() => {
      toast.success('User blocked');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversationId(null);
    });
  }

  function handleReport(targetUserId: string) {
    reportUser(targetUserId, 'Inappropriate Chat').then(() => {
      toast.success('User reported');
    });
  }

  const activeConv = conversations.find((c) => c._id === activeConversationId);
  const activeMessages = activeConversationId ? messagesMap[activeConversationId] || [] : [];
  const recipient = activeConv?.recipient;
  const isOnline = recipient ? onlineUsers.has(getUserId(recipient)) : false;
  const isTyping = activeConversationId ? (typingMap[activeConversationId] || []).length > 0 : false;

  return (
    <div className="mx-auto h-[calc(100dvh-4rem-var(--sat))] w-full max-w-7xl overflow-hidden md:p-4">
      <div className="flex h-full w-full overflow-hidden bg-white md:rounded-[2rem] md:border md:border-gray-200/70 md:shadow-card dark:bg-gray-900 md:dark:border-gray-800">
        {/* Sidebar / Conversation List */}
        <div
          className={`h-full w-full md:w-80 lg:w-96 flex-shrink-0 ${
            mobileView === 'chat' ? 'hidden md:block' : 'block'
          }`}
        >
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onMuteToggle={handleMuteToggle}
            onArchiveToggle={handleArchiveToggle}
            onDeleteConversation={handleDeleteConv}
            onlineUsers={onlineUsers}
            typingMap={typingMap}
          />
        </div>

        {/* Active Chat Window */}
        <div
          className={`h-full flex-1 ${
            mobileView === 'list' ? 'hidden md:block' : 'block'
          }`}
        >
          {activeConv ? (
            <ChatWindow
              conversation={activeConv}
              messages={activeMessages}
              currentUserId={getUserId(currentUser!)}
              isOnline={isOnline}
              isTyping={isTyping}
              onSendMessage={handleSendMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              onBlockUser={handleBlock}
              onReportUser={handleReport}
              onBackMobile={() => setMobileView('list')}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 bg-gray-50/50 dark:bg-gray-950/40">
              <EmptyState
                title="Select a conversation"
                description="Choose an existing chat from the list or start a new private chat from Friends."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
