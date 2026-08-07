import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { searchUsers, sendFriendRequest } from '../api/friendApi';
import { createOrGetConversation } from '../api/chatApi';
import { getUserId } from '../types/user';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../store/toastStore';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useSessionState } from '../hooks/useSessionState';

export default function SearchPage() {
  const [q, setQ] = useSessionState('nearme.search.query', '');
  const [city, setCity] = useSessionState('nearme.search.city', '');
  const [country, setCountry] = useSessionState('nearme.search.country', '');
  const [interests, setInterests] = useSessionState('nearme.search.interests', '');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rawFilters = useMemo(() => ({ q, city, country, interests }), [q, city, country, interests]);
  const searchFilters = useDebouncedValue(rawFilters, 350);

  const searchQuery = useQuery({
    queryKey: ['search', searchFilters],
    queryFn: ({ signal }) => searchUsers(searchFilters, signal),
    placeholderData: (previous) => previous,
  });

  const connectMutation = useMutation({
    mutationFn: (targetUserId: string) => sendFriendRequest(targetUserId),
    onSuccess: () => {
      toast.success('Connection request sent!');
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Failed to send request.');
    },
  });

  const chatMutation = useMutation({
    mutationFn: (recipientId: string) => createOrGetConversation(recipientId),
    onSuccess: (data) => {
      navigate('/chat', { state: { conversationId: data.conversation._id } });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Unable to start chat.');
    },
  });

  return (
    <div className="page-shell max-w-5xl space-y-5">
      <div>
        <p className="eyebrow">Explore the community</p><h1 className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">Find someone interesting</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Find and connect with people by name, city, country, or shared passions
        </p>
      </div>

      {/* Filter inputs grid */}
      <div className="app-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search name or bio"
            placeholder="e.g. Alex"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Input
            label="City"
            placeholder="e.g. San Francisco"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            label="Country"
            placeholder="e.g. USA"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <Input
            label="Interests"
            placeholder="e.g. Coding, Music"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>
      </div>

      {/* Results grid */}
      {searchQuery.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {searchQuery.isError && (
        <EmptyState
          title="Search failed"
          description="Unable to fetch users at this time. Please try again."
        />
      )}

      {!searchQuery.isPending && !searchQuery.isError && searchQuery.data?.users.length === 0 && (
        <EmptyState
          title="No people found"
          description="Try broadening your search criteria or searching for something else."
        />
      )}

      {searchQuery.data && searchQuery.data.users.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {searchQuery.data.users.map((item) => {
            const uid = getUserId(item.user);
            return (
              <div
                key={uid}
                className="app-card flex flex-col justify-between p-5 transition-all hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <Avatar
                      src={item.user.avatarUrl}
                      alt={item.user.displayName}
                      seed={item.user.username || item.user.displayName}
                      size="lg"
                      shape="squircle"
                      showOnlineStatus={Boolean(item.user.lastSeenAt)}
                      isOnline={Boolean(item.user.lastSeenAt)}
                    />
                    {item.user.city && item.user.country && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        📍 {item.user.city}, {item.user.country}
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {item.user.displayName}
                    </h3>
                    <p className="text-xs text-gray-500">@{item.user.username}</p>
                  </div>

                  {item.user.bio && (
                    <p className="mt-2 text-xs text-gray-600 line-clamp-2 dark:text-gray-300">
                      {item.user.bio}
                    </p>
                  )}

                  {item.mutualInterests && item.mutualInterests.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.mutualInterests.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                        >
                          ✨ {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                  {item.connectionStatus === 'connected' ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => chatMutation.mutate(uid)}
                      isLoading={chatMutation.isPending}
                    >
                      💬 Message
                    </Button>
                  ) : item.connectionStatus === 'pending_sent' ? (
                    <Button size="sm" variant="secondary" disabled className="w-full">
                      Pending Request
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => connectMutation.mutate(uid)}
                      isLoading={connectMutation.isPending}
                    >
                      + Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
