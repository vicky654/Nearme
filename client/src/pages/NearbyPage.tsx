import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IonIcon, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/react';
import {
  chatbubble,
  close,
  flagOutline,
  grid,
  list,
  locate,
  location,
  mapOutline,
  options,
  people,
  peopleOutline,
  refresh,
  sparkles,
} from 'ionicons/icons';
import { getNearbyUsers, updateLocation, sendFriendRequest, reportUser, NearbyUserItem } from '../api/friendApi';
import { createOrGetConversation } from '../api/chatApi';
import { getUserId } from '../types/user';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../store/toastStore';
import { useSessionState } from '../hooks/useSessionState';

const RADII = [1, 5, 10, 20];
const FALLBACK_ANGLE = Math.PI * (3 - Math.sqrt(5));

export default function NearbyPage() {
  const [radius, setRadius] = useSessionState('nearme.nearby.radius', 20);
  const [onlineOnly, setOnlineOnly] = useSessionState('nearme.nearby.online', false);
  const [view, setView] = useSessionState<'grid' | 'list'>('nearme.nearby.view', 'grid');
  const [visibleCount, setVisibleCount] = useState(24);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportModalUser, setReportModalUser] = useState<NearbyUserItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const nearbyQuery = useQuery({ queryKey: ['nearby', radius], queryFn: () => getNearbyUsers(radius) });

  const locationMutation = useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) => updateLocation(lat, lng),
    onSuccess: () => {
      toast.success('Location updated');
      queryClient.invalidateQueries({ queryKey: ['nearby'] });
    },
    onError: () => toast.error('Unable to update location.'),
  });
  const connectMutation = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      toast.success('Connection request sent');
      queryClient.invalidateQueries({ queryKey: ['nearby'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to send request.'),
  });
  const chatMutation = useMutation({
    mutationFn: createOrGetConversation,
    onSuccess: ({ conversation }) => navigate('/chat', { state: { conversationId: conversation._id } }),
    onError: () => toast.error('Unable to open chat.'),
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

  function updateDeviceLocation() {
    if (!navigator.geolocation) return toast.error('Location is not available on this device.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => locationMutation.mutate({ lat: coords.latitude, lng: coords.longitude }),
      () => toast.error('Allow location access to discover people nearby.'),
    );
  }

  const allUsers = nearbyQuery.data?.users ?? [];
  const users = useMemo(
    () => allUsers.filter((item) => !onlineOnly || Boolean(item.user.lastSeenAt)),
    [allUsers, onlineOnly],
  );
  const meta = nearbyQuery.data?.meta;
  const totalRegistered = meta?.totalRegistered ?? allUsers.length;
  const totalOnline = meta?.totalOnline ?? allUsers.filter((item) => Boolean(item.user.lastSeenAt)).length;
  const visibleUsers = users.slice(0, visibleCount);
  const hasMore = visibleCount < users.length;

  useEffect(() => setVisibleCount(24), [radius, onlineOnly]);

  return (
    <div className="page-shell space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#20285d_0%,#3e49c5_48%,#8b5cf6_100%)] p-5 text-white shadow-[0_24px_60px_-26px_rgba(62,73,197,.72)] sm:p-7"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-white/85 backdrop-blur">
              <IonIcon icon={sparkles} /> Live discovery
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-4xl">Find your people</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-indigo-100/85">
              Browse the NearMe community, find a shared interest, and start a conversation in one tap.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/90">
                {totalRegistered} registered
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1.5 text-xs font-semibold text-emerald-50">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> {totalOnline} online
              </span>
              {meta?.showingAllUsers && (
                <span className="rounded-full border border-amber-200/20 bg-amber-300/15 px-3 py-1.5 text-xs font-semibold text-amber-50">
                  Development mode · all profiles
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFiltersOpen(true)}
              className="border-white/15 bg-white/10 text-white hover:bg-white/20"
            >
              <IonIcon icon={options} /> Filters
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void nearbyQuery.refetch()}
              className="border-white/15 bg-white/10 text-white hover:bg-white/20"
            >
              <IonIcon icon={refresh} /> Refresh
            </Button>
          </div>
        </div>
      </motion.section>

      <DiscoveryMap
        users={users}
        radius={radius}
        showingAllUsers={Boolean(meta?.showingAllUsers)}
        isLocating={locationMutation.isPending}
        onLocate={updateDeviceLocation}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-none flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-bold uppercase tracking-[.12em] text-gray-400">Radius</span>
          {RADII.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRadius(value)}
              className={`min-h-10 shrink-0 rounded-2xl px-4 text-xs font-bold transition ${
                radius === value
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {value} km
            </button>
          ))}
          <button
            type="button"
            aria-pressed={onlineOnly}
            onClick={() => setOnlineOnly((value) => !value)}
            className={`min-h-10 shrink-0 rounded-2xl px-4 text-xs font-bold transition ${
              onlineOnly
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
            }`}
          >
            Online now
          </button>
        </div>
        <div className="flex items-center gap-1 self-end rounded-2xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900 sm:self-auto">
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => setView('grid')}
            className={`grid h-9 w-9 place-items-center rounded-xl transition ${view === 'grid' ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-100'}`}
          >
            <IonIcon icon={grid} />
          </button>
          <button
            type="button"
            aria-label="List view"
            onClick={() => setView('list')}
            className={`grid h-9 w-9 place-items-center rounded-xl transition ${view === 'list' ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-100'}`}
          >
            <IonIcon icon={list} />
          </button>
        </div>
      </div>

      {nearbyQuery.isPending && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-72 rounded-[1.6rem]" />)}
        </div>
      )}
      {nearbyQuery.isError && (
        <EmptyState
          title="Couldn’t load nearby people"
          description="Check your connection and try discovery again."
          action={<Button onClick={() => nearbyQuery.refetch()}>Try again</Button>}
        />
      )}
      {!nearbyQuery.isPending && !nearbyQuery.isError && users.length === 0 && (
        <EmptyState
          title={onlineOnly ? 'No one is online right now' : 'No one here just yet'}
          description={onlineOnly ? 'Turn off Online now to browse every profile.' : 'Try a wider radius or refresh your location.'}
          action={<Button onClick={() => (onlineOnly ? setOnlineOnly(false) : setRadius(20))}>{onlineOnly ? 'Show everyone' : 'Search 20 km'}</Button>}
        />
      )}
      {users.length > 0 && (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Community pulse</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">{onlineOnly ? 'People online now' : 'Everyone near you'}</h2>
            </div>
            <span className="shrink-0 text-xs font-semibold text-gray-400">{users.length} shown</span>
          </div>
          <motion.div layout className={view === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
            {visibleUsers.map((item, index) => (
              <PersonCard
                key={getUserId(item.user)}
                item={item}
                compact={view === 'list'}
                index={index}
                onConnect={() => connectMutation.mutate(getUserId(item.user))}
                onChat={() => chatMutation.mutate(getUserId(item.user))}
                onReport={() => setReportModalUser(item)}
              />
            ))}
          </motion.div>
          <IonInfiniteScroll
            threshold="180px"
            disabled={!hasMore}
            onIonInfinite={(event) => {
              setVisibleCount((count) => Math.min(count + 24, users.length));
              event.target.complete();
            }}
          >
            <IonInfiniteScrollContent loadingSpinner="crescent" loadingText="Finding more people…" />
          </IonInfiniteScroll>
        </>
      )}

      <AnimatePresence>
        {filtersOpen && (
          <Modal onClose={() => setFiltersOpen(false)} title="Discovery filters">
            <div className="space-y-5">
              <FilterRow label="Online only" hint="Show people active recently"><Switch checked={onlineOnly} onChange={setOnlineOnly} /></FilterRow>
              <FilterRow label="All profiles" hint={meta?.showingAllUsers ? 'Development mode is enabled' : 'Distance filtering is active'}><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${meta?.showingAllUsers ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'}`}>{meta?.showingAllUsers ? 'On' : 'Off'}</span></FilterRow>
              <div><label className="text-xs font-bold">Radius preference</label><div className="mt-2 rounded-2xl bg-gray-100 p-4 text-center text-xs font-semibold text-gray-500 dark:bg-gray-800">{radius} km</div></div>
              <Button className="w-full" onClick={() => setFiltersOpen(false)}>Show {users.length} people</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {reportModalUser && (
          <Modal onClose={() => setReportModalUser(null)} title={`Report ${reportModalUser.user.displayName}`}>
            <div className="space-y-3">
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="min-h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800">
                <option value="">Choose a reason</option><option value="inappropriate_content">Inappropriate content</option><option value="harassment">Harassment</option><option value="spam">Spam or bot</option><option value="fake_account">Fake account</option>
              </select>
              <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={3} placeholder="Add details (optional)" className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800" />
              <Button variant="danger" className="w-full" disabled={!reportReason} isLoading={reportMutation.isPending} onClick={() => reportMutation.mutate()}>Submit report</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function DiscoveryMap({ users, radius, showingAllUsers, isLocating, onLocate }: { users: NearbyUserItem[]; radius: number; showingAllUsers: boolean; isLocating: boolean; onLocate: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedUser = users.find((item) => getUserId(item.user) === selectedId);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-indigo-200/70 bg-[#e7edff] shadow-[0_18px_45px_-28px_rgba(62,73,197,.62)] dark:border-indigo-900/60 dark:bg-[#19213c]">
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(91,108,249,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(91,108,249,.12) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_42%,rgba(255,255,255,.78),transparent_42%)] dark:bg-[radial-gradient(circle_at_45%_42%,rgba(92,108,249,.18),transparent_42%)]" />
      <div className="relative h-[300px] overflow-hidden sm:h-[340px]">
        <div className="absolute left-[48%] top-[48%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-500/30 bg-brand-500/5" />
        <div className="absolute left-[48%] top-[48%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-500/30 bg-brand-500/5" />
        <motion.div animate={{ scale: [1, 1.12, 1], opacity: [.7, .25, .7] }} transition={{ repeat: Infinity, duration: 3.2 }} className="absolute left-[48%] top-[48%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand-500/50 bg-brand-500/10" />
        <div className="absolute left-[48%] top-[48%] z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-brand-600 text-white shadow-xl shadow-brand-600/30 dark:border-gray-900"><IonIcon icon={peopleOutline} /></div>
        {users.map((item, index) => {
          const position = markerPosition(item, index, users);
          return (
            <motion.button
              key={getUserId(item.user)}
              type="button"
              title={`Open ${item.user.displayName}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.12, zIndex: 20 }}
              whileTap={{ scale: .94 }}
              onClick={() => setSelectedId((current) => current === getUserId(item.user) ? null : getUserId(item.user))}
              className="absolute z-[5] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white bg-white p-0.5 shadow-lg shadow-indigo-900/15 dark:border-gray-900 dark:bg-gray-900"
              style={{ left: `${position.left}%`, top: `${position.top}%` }}
            >
              <span className="relative block h-11 w-11 overflow-hidden rounded-[.8rem] bg-gradient-to-br from-brand-300 to-violet-400 sm:h-12 sm:w-12"><img src={item.user.avatarUrl} alt="" className="h-full w-full object-cover" /><span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${item.user.lastSeenAt ? 'bg-emerald-400' : 'bg-gray-300'}`} /></span>
            </motion.button>
          );
        })}
        <AnimatePresence>
          {selectedUser && <motion.div initial={{ opacity: 0, y: 8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .96 }} className="absolute right-4 top-16 z-20 max-w-[12rem] rounded-2xl border border-white/80 bg-white/90 px-3 py-2 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/90"><p className="truncate text-xs font-black text-gray-900 dark:text-white">{selectedUser.user.displayName}</p><p className="mt-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">{selectedUser.user.lastSeenAt ? 'Online now' : 'Ready to connect'}</p></motion.div>}
        </AnimatePresence>
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/80 px-3 py-2 text-[11px] font-black text-gray-800 shadow-sm backdrop-blur dark:border-gray-700/70 dark:bg-gray-900/75 dark:text-gray-100"><IonIcon icon={mapOutline} className="text-brand-600" /> {showingAllUsers ? 'All community profiles' : `Within ${radius} km`}</span>
          <span className="rounded-full border border-white/70 bg-white/70 px-3 py-2 text-[11px] font-bold text-gray-600 shadow-sm backdrop-blur dark:border-gray-700/70 dark:bg-gray-900/65 dark:text-gray-300">{users.length} markers</span>
        </div>
        <button type="button" onClick={onLocate} className="absolute bottom-4 right-4 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-xs font-extrabold text-gray-800 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-gray-900 dark:text-gray-100"><IonIcon icon={locate} className="text-brand-600" /> {isLocating ? 'Locating…' : 'Center me'}</button>
      </div>
    </section>
  );
}

function markerPosition(item: NearbyUserItem, index: number, users: NearbyUserItem[]) {
  if (item.location.hasLocation) {
    const located = users.filter((candidate) => candidate.location.hasLocation);
    const longitudes = located.map((candidate) => candidate.location.longitude ?? 0);
    const latitudes = located.map((candidate) => candidate.location.latitude ?? 0);
    const minLng = Math.min(...longitudes); const maxLng = Math.max(...longitudes); const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
    const lngRange = maxLng - minLng || 1; const latRange = maxLat - minLat || 1;
    return { left: 18 + (((item.location.longitude ?? minLng) - minLng) / lngRange) * 64, top: 20 + (1 - ((item.location.latitude ?? minLat) - minLat) / latRange) * 58 };
  }
  const angle = index * FALLBACK_ANGLE;
  const radius = 24 + (index % 4) * 5;
  return { left: 48 + Math.cos(angle) * radius, top: 48 + Math.sin(angle) * radius * .72 };
}

function PersonCard({ item, compact, index, onConnect, onChat, onReport }: { item: NearbyUserItem; compact: boolean; index: number; onConnect: () => void; onChat: () => void; onReport: () => void }) {
  const connected = item.connectionStatus === 'connected';
  const online = Boolean(item.user.lastSeenAt);
  const distanceLabel = item.distanceKm !== null ? `${item.distanceKm} km away` : item.location.hasLocation ? 'Distance hidden' : 'Location pending';
  return (
    <motion.article layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .18) }} whileHover={{ y: -4 }} className={`app-card group overflow-hidden ${compact ? 'flex items-center p-3' : ''}`}>
      <div className={`relative overflow-hidden ${compact ? 'h-20 w-20 shrink-0 rounded-2xl' : 'h-48'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-brand-300 via-violet-400 to-fuchsia-400" />
        <img loading="lazy" decoding="async" src={item.user.avatarUrl} alt={item.user.displayName} className="relative h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/65 via-transparent to-transparent" />
        {!compact && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-extrabold text-gray-800 shadow-sm"><IonIcon icon={location} className="text-brand-600" /> {distanceLabel}</span>}
        <span className={`absolute right-3 top-3 h-3 w-3 rounded-full border-2 border-white shadow-sm ${online ? 'bg-emerald-400' : 'bg-gray-300'}`} />
      </div>
      <div className={`min-w-0 ${compact ? 'flex flex-1 items-center gap-3 pl-3' : 'p-4'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><h2 className="truncate text-sm font-extrabold text-gray-950 dark:text-white">{item.user.displayName}</h2>{online && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}</div>
          <p className="truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">@{item.user.username}</p>
          <p className={`${compact ? 'mt-1' : 'mt-2'} truncate text-[11px] text-gray-400`}>{item.mutualInterests.slice(0, 2).join(' · ') || item.user.bio || distanceLabel}</p>
          {!compact && <div className="mt-3 flex items-center gap-1.5"><span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{online ? 'Online now' : 'Ready to connect'}</span>{!item.location.hasLocation && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">Location pending</span>}</div>}
        </div>
        <div className={`${compact ? 'flex' : 'mt-4 flex'} gap-2`}>
          {connected ? <button type="button" aria-label={`Message ${item.user.displayName}`} onClick={onChat} className="grid h-10 min-w-10 flex-1 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 px-3 text-white shadow-md shadow-brand-500/20 transition hover:-translate-y-0.5"><IonIcon icon={chatbubble} /></button> : item.connectionStatus === 'pending_sent' ? <span className="flex h-10 flex-1 items-center justify-center rounded-2xl bg-gray-100 px-2 text-[10px] font-bold text-gray-400 dark:bg-gray-800">Pending</span> : <button type="button" onClick={onConnect} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 px-3 text-[11px] font-bold text-white shadow-md shadow-brand-500/20 transition hover:-translate-y-0.5"><IonIcon icon={people} /> Connect</button>}
          <button type="button" aria-label={`Report ${item.user.displayName}`} onClick={onReport} className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-100 text-gray-400 transition hover:bg-coral/10 hover:text-coral dark:bg-gray-800"><IonIcon icon={flagOutline} /></button>
        </div>
      </div>
    </motion.article>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="w-full max-w-md rounded-t-[2rem] border border-white/15 bg-white p-5 pb-[max(1.25rem,var(--sab))] shadow-2xl dark:bg-gray-900 sm:rounded-[2rem]"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button type="button" aria-label="Close" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"><IonIcon icon={close} /></button></div>{children}</motion.div></div>;
}

function FilterRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) { return <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold">{label}</p><p className="text-[11px] text-gray-400">{hint}</p></div>{children}</div>; }
function Switch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) { return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button>; }
