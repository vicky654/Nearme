import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getFriends, getFriendRequests, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, removeFriend, unblockUser } from '../api/friendApi';
import { createOrGetConversation } from '../api/chatApi';
import { getUserId } from '../types/user';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../store/toastStore';

type Tab = 'friends' | 'pending' | 'blocked';

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
  });

  const requestsQuery = useQuery({
    queryKey: ['friend-requests'],
    queryFn: getFriendRequests,
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => acceptFriendRequest(requestId),
    onSuccess: () => {
      toast.success('Request accepted');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => rejectFriendRequest(requestId),
    onSuccess: () => {
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => cancelFriendRequest(requestId),
    onSuccess: () => {
      toast.success('Request cancelled');
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (friendId: string) => removeFriend(friendId),
    onSuccess: () => {
      toast.success('Friend removed');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (targetUserId: string) => unblockUser(targetUserId),
    onSuccess: () => {
      toast.success('User unblocked');
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const chatMutation = useMutation({
    mutationFn: (recipientId: string) => createOrGetConversation(recipientId),
    onSuccess: (data) => {
      navigate('/chat', { state: { conversationId: data.conversation._id } });
    },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Friends & Connections</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your connections, pending requests, and blocked accounts
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('friends')}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'friends'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          My Friends ({friendsQuery.data?.friends.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'pending'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Pending Requests ({requestsQuery.data?.incoming.length ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('blocked')}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'blocked'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Blocked Users ({requestsQuery.data?.blocked.length ?? 0})
        </button>
      </div>

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <div>
          {friendsQuery.isPending && <Skeleton className="h-48 w-full rounded-2xl" />}
          {friendsQuery.data && friendsQuery.data.friends.length === 0 && (
            <EmptyState
              title="No friends yet"
              description="Explore Nearby users or use Search to discover and connect with people!"
            />
          )}
          {friendsQuery.data && friendsQuery.data.friends.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {friendsQuery.data.friends.map(({ friendshipId, user }) => (
                <div
                  key={friendshipId}
                  className="flex flex-col justify-between rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName}
                          className="h-12 w-12 rounded-full object-cover shadow-sm"
                        />
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">
                          {user.displayName}
                        </h4>
                        <p className="text-xs text-gray-500">@{user.username}</p>
                        {user.city && user.country && (
                          <p className="text-[10px] text-gray-400">📍 {user.city}, {user.country}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => chatMutation.mutate(getUserId(user))}
                        isLoading={chatMutation.isPending}
                      >
                        💬 Chat
                      </Button>
                      <Button size="sm" variant="secondary" disabled title="Voice calling coming soon in Phase 3">
                        📞 Call
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(getUserId(user))}
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div className="flex flex-col gap-6">
          {/* Incoming */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Incoming Requests ({requestsQuery.data?.incoming.length ?? 0})
            </h3>
            {requestsQuery.data?.incoming.length === 0 ? (
              <p className="text-sm text-gray-500">No incoming friend requests.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {requestsQuery.data?.incoming.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.user.avatarUrl}
                        alt={item.user.displayName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {item.user.displayName}
                        </h4>
                        <p className="text-xs text-gray-500">@{item.user.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => acceptMutation.mutate(item.id)}
                        isLoading={acceptMutation.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => rejectMutation.mutate(item.id)}
                        isLoading={rejectMutation.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Sent Requests ({requestsQuery.data?.outgoing.length ?? 0})
            </h3>
            {requestsQuery.data?.outgoing.length === 0 ? (
              <p className="text-sm text-gray-500">No pending sent requests.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {requestsQuery.data?.outgoing.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.user.avatarUrl}
                        alt={item.user.displayName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {item.user.displayName}
                        </h4>
                        <p className="text-xs text-gray-500">@{item.user.username}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => cancelMutation.mutate(item.id)}
                      isLoading={cancelMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blocked Users Tab */}
      {activeTab === 'blocked' && (
        <div>
          {requestsQuery.data?.blocked.length === 0 ? (
            <p className="text-sm text-gray-500">You have no blocked users.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {requestsQuery.data?.blocked.map((u) => (
                <div
                  key={getUserId(u)}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={u.avatarUrl}
                      alt={u.displayName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {u.displayName}
                      </h4>
                      <p className="text-xs text-gray-500">@{u.username}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => unblockMutation.mutate(getUserId(u))}
                    isLoading={unblockMutation.isPending}
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
