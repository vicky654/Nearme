import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getNearbyUsers, updateLocation, sendFriendRequest, reportUser, NearbyUserItem } from '../api/friendApi';
import { createOrGetConversation } from '../api/chatApi';
import { getUserId } from '../types/user';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../store/toastStore';

const RADII = [1, 5, 10, 20];

export default function NearbyPage() {
  const [radius, setRadius] = useState<number>(20);
  const [reportModalUser, setReportModalUser] = useState<NearbyUserItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const nearbyQuery = useQuery({
    queryKey: ['nearby', radius],
    queryFn: () => getNearbyUsers(radius),
  });

  const locationMutation = useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) => updateLocation(lat, lng),
    onSuccess: () => {
      toast.success('Location updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['nearby'] });
    },
    onError: () => toast.error('Unable to update location.'),
  });

  const connectMutation = useMutation({
    mutationFn: (targetUserId: string) => sendFriendRequest(targetUserId),
    onSuccess: () => {
      toast.success('Connection request sent!');
      queryClient.invalidateQueries({ queryKey: ['nearby'] });
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
      toast.error(err?.response?.data?.error ?? 'Unable to open chat.');
    },
  });

  const reportMutation = useMutation({
    mutationFn: () => reportUser(getUserId(reportModalUser!.user), reportReason, reportDetails),
    onSuccess: () => {
      toast.success('Report submitted');
      setReportModalUser(null);
      setReportReason('');
      setReportDetails('');
    },
    onError: () => toast.error('Failed to submit report'),
  });

  function handleUpdateLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        toast.error('Unable to access device location.');
      }
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nearby Discovery</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Find and connect with people near you
          </p>
        </div>
        <Button
          onClick={handleUpdateLocation}
          isLoading={locationMutation.isPending}
          variant="secondary"
          size="sm"
        >
          📍 Update Location
        </Button>
      </div>

      {/* Map Preview Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl backdrop-blur">
              🗺️
            </div>
            <div>
              <h3 className="font-bold text-base">Radar Map Discovery Active</h3>
              <p className="text-xs text-indigo-200">
                Scanning your vicinity for connected users within {radius} km.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-400 animate-ping" />
            <span className="text-xs font-semibold text-green-300">Live Scanning</span>
          </div>
        </div>
      </div>

      {/* Radius Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Distance radius:</span>
        {RADII.map((r) => (
          <button
            key={r}
            onClick={() => setRadius(r)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              radius === r
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            Within {r} km
          </button>
        ))}
      </div>

      {/* Content */}
      {nearbyQuery.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {nearbyQuery.isError && (
        <EmptyState
          title="Couldn't load nearby users"
          description="Make sure location is enabled or try updating your location."
        />
      )}

      {nearbyQuery.data && nearbyQuery.data.users.length === 0 && (
        <EmptyState
          title="No users found nearby"
          description="Try increasing your distance radius or update your location to discover people."
        />
      )}

      {nearbyQuery.data && nearbyQuery.data.users.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {nearbyQuery.data.users.map((item) => (
            <div
              key={item.user._id}
              className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="relative">
                    <img
                      src={item.user.avatarUrl}
                      alt={item.user.displayName}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                    {item.user.lastSeenAt && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
                    )}
                  </div>
                  {item.distanceKm !== null && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                      {item.distanceKm} km away
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {item.user.displayName}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">@{item.user.username}</p>
                  {item.user.city && item.user.country && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      📍 {item.user.city}, {item.user.country}
                    </p>
                  )}
                </div>

                {item.user.bio && (
                  <p className="mt-2 text-xs text-gray-600 line-clamp-2 dark:text-gray-300">
                    {item.user.bio}
                  </p>
                )}

                {item.mutualInterests.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.mutualInterests.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                {item.connectionStatus === 'connected' ? (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => chatMutation.mutate(getUserId(item.user))}
                    isLoading={chatMutation.isPending}
                  >
                    💬 Message
                  </Button>
                ) : item.connectionStatus === 'pending_sent' ? (
                  <Button size="sm" variant="secondary" disabled className="w-full">
                    Pending
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => connectMutation.mutate(getUserId(item.user))}
                    isLoading={connectMutation.isPending}
                  >
                    + Connect
                  </Button>
                )}
                <button
                  type="button"
                  title="Report User"
                  onClick={() => setReportModalUser(item)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                >
                  🚩
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {reportModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Report {reportModalUser.user.displayName}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Reason</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Select a reason</option>
                <option value="inappropriate_content">Inappropriate Content</option>
                <option value="harassment">Harassment</option>
                <option value="spam">Spam / Bot</option>
                <option value="fake_account">Fake Account</option>
              </select>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Details (optional)
              </label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                className="rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                placeholder="Provide extra context..."
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setReportModalUser(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!reportReason}
                isLoading={reportMutation.isPending}
                onClick={() => reportMutation.mutate()}
              >
                Submit Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
