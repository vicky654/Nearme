import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getNearbyUsers, getFriendRequests } from '../api/friendApi';
import { getConversations } from '../api/chatApi';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { getUserId } from '../types/user';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const nearbyQuery = useQuery({ queryKey: ['nearby-preview'], queryFn: () => getNearbyUsers(20) });
  const requestsQuery = useQuery({ queryKey: ['friend-requests-preview'], queryFn: getFriendRequests });
  const chatsQuery = useQuery({ queryKey: ['conversations-preview'], queryFn: getConversations });

  const nearbyUsers = nearbyQuery.data?.users.slice(0, 4) || [];
  const pendingRequests = requestsQuery.data?.incoming.slice(0, 3) || [];
  const activeChats = chatsQuery.data?.conversations.slice(0, 3) || [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6 animate-in fade-in duration-300">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
              👋 Welcome back
            </span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              Hello, {user?.displayName ?? 'Explorer'}!
            </h1>
            <p className="mt-1 max-w-xl text-sm text-indigo-100">
              Discover people near you, keep up with friends, and start real-time conversations.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold"
              onClick={() => navigate('/nearby')}
            >
              📍 Discover Nearby
            </Button>
            <Button
              variant="secondary"
              className="bg-indigo-900/40 text-white border-white/20 hover:bg-indigo-900/60"
              onClick={() => navigate('/chat')}
            >
              💬 Open Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Action Tiles / Statistics Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            📍
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Nearby Users</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {nearbyQuery.data?.users.length ?? 0} People
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
            🤝
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending Requests</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {requestsQuery.data?.incoming.length ?? 0} Incoming
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            💬
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active Conversations</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {chatsQuery.data?.conversations.length ?? 0} Chats
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            ⚡
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Online Status</p>
            <h3 className="text-xl font-bold text-green-600">Active Now</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Columns: Nearby People & Conversations */}
        <div className="flex flex-col gap-8 lg:col-span-2">
          {/* Nearby Users Preview */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">People Nearby</h2>
              <Link to="/nearby" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                Explore all →
              </Link>
            </div>

            {nearbyQuery.isPending ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}
              </div>
            ) : nearbyUsers.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900">
                No nearby users discovered yet. Update your location in Nearby Discovery!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {nearbyUsers.map((item) => (
                  <div
                    key={getUserId(item.user)}
                    className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.user.avatarUrl}
                        alt={item.user.displayName}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                          {item.user.displayName}
                        </h4>
                        <p className="text-xs text-gray-500">@{item.user.username}</p>
                      </div>
                    </div>
                    {item.distanceKm !== null && (
                      <span className="mt-2 w-fit rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                        📍 {item.distanceKm} km away
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Conversations */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Recent Messages</h2>
              <Link to="/chat" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                Go to Chat →
              </Link>
            </div>

            {activeChats.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900">
                No active conversations yet. Start a chat with friends!
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {activeChats.map((c) => (
                  <div
                    key={c._id}
                    onClick={() => navigate('/chat', { state: { conversationId: c._id } })}
                    className="flex cursor-pointer items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={c.recipient?.avatarUrl}
                        alt={c.recipient?.displayName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {c.recipient?.displayName}
                        </h4>
                        <p className="text-xs text-gray-500 truncate">
                          {c.lastMessage?.content || 'No messages'}
                        </p>
                      </div>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        {c.unreadCount} new
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Friend Requests Widget */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Friend Requests</h2>
            <Link to="/friends" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              View all →
            </Link>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {pendingRequests.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No pending friend requests.</p>
            ) : (
              pendingRequests.map((reqItem) => (
                <div
                  key={reqItem.id}
                  className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={reqItem.user.avatarUrl}
                      alt={reqItem.user.displayName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {reqItem.user.displayName}
                      </h4>
                      <p className="text-[10px] text-gray-500">@{reqItem.user.username}</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => navigate('/friends')}>
                    Review
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
