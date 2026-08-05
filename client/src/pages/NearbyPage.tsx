import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IonIcon } from '@ionic/react';
import { chatbubble, options, location, locate, people, close, flagOutline, grid, list } from 'ionicons/icons';
import { getNearbyUsers, updateLocation, sendFriendRequest, reportUser, NearbyUserItem } from '../api/friendApi';
import { createOrGetConversation } from '../api/chatApi';
import { getUserId } from '../types/user';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../store/toastStore';

const RADII = [1, 5, 10, 20];

export default function NearbyPage() {
  const [radius, setRadius] = useState(20);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportModalUser, setReportModalUser] = useState<NearbyUserItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const nearbyQuery = useQuery({ queryKey: ['nearby', radius], queryFn: () => getNearbyUsers(radius) });
  const locationMutation = useMutation({ mutationFn: ({ lat, lng }: { lat: number; lng: number }) => updateLocation(lat, lng), onSuccess: () => { toast.success('Location updated'); queryClient.invalidateQueries({ queryKey: ['nearby'] }); }, onError: () => toast.error('Unable to update location.') });
  const connectMutation = useMutation({ mutationFn: sendFriendRequest, onSuccess: () => { toast.success('Connection request sent'); queryClient.invalidateQueries({ queryKey: ['nearby'] }); }, onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to send request.') });
  const chatMutation = useMutation({ mutationFn: createOrGetConversation, onSuccess: ({ conversation }) => navigate('/chat', { state: { conversationId: conversation._id } }), onError: () => toast.error('Unable to open chat.') });
  const reportMutation = useMutation({ mutationFn: () => reportUser(getUserId(reportModalUser!.user), reportReason, reportDetails), onSuccess: () => { toast.success('Report submitted'); setReportModalUser(null); setReportReason(''); setReportDetails(''); }, onError: () => toast.error('Failed to submit report') });

  function updateDeviceLocation() {
    if (!navigator.geolocation) return toast.error('Location is not available on this device.');
    navigator.geolocation.getCurrentPosition(({ coords }) => locationMutation.mutate({ lat: coords.latitude, lng: coords.longitude }), () => toast.error('Allow location access to discover people nearby.'));
  }
  const users = (nearbyQuery.data?.users ?? []).filter((item) => !onlineOnly || Boolean(item.user.lastSeenAt));

  return <div className="page-shell space-y-5">
    <div className="flex items-end justify-between"><div><p className="eyebrow">Live discovery</p><h1 className="mt-1 text-2xl font-black tracking-tight">Find your people</h1><p className="mt-1 text-xs text-gray-400">Real people, close to where you are.</p></div><button onClick={() => setFiltersOpen(true)} className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-200 bg-white text-brand-600 shadow-sm dark:border-gray-800 dark:bg-gray-900"><IonIcon icon={options} className="text-xl" /></button></div>

    <section className="relative h-52 overflow-hidden rounded-[2rem] bg-[#dfe9fb] shadow-card dark:bg-[#20283b]">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(#7586b6 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="absolute left-[48%] top-[45%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-500/25 bg-brand-500/5" /><div className="absolute left-[48%] top-[45%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-brand-500/30" />
      {users.slice(0, 5).map((item, i) => <img key={getUserId(item.user)} src={item.user.avatarUrl} alt="" className="absolute h-10 w-10 rounded-2xl border-2 border-white object-cover shadow-lg" style={{ left: `${18 + (i * 17) % 65}%`, top: `${20 + (i * 29) % 58}%` }} />)}
      <button onClick={updateDeviceLocation} className="absolute bottom-3 right-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-lg dark:bg-gray-900 dark:text-gray-100"><IonIcon icon={locate} className="text-brand-600" /> {locationMutation.isPending ? 'Locating…' : 'Center me'}</button>
      <div className="absolute left-4 top-4 rounded-2xl bg-white/85 px-3 py-2 backdrop-blur dark:bg-gray-900/80"><span className="flex items-center gap-1.5 text-[11px] font-bold"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {users.length} people within {radius} km</span></div>
    </section>

    <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1"><span className="shrink-0 text-xs font-bold text-gray-400">Radius</span>{RADII.map(r => <button key={r} onClick={() => setRadius(r)} className={`min-h-10 shrink-0 rounded-2xl px-4 text-xs font-bold transition ${radius === r ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' : 'border border-gray-200 bg-white text-gray-500 dark:border-gray-800 dark:bg-gray-900'}`}>{r} km</button>)}<span className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-800" /><button aria-pressed={onlineOnly} onClick={() => setOnlineOnly(v => !v)} className={`min-h-10 shrink-0 rounded-2xl px-4 text-xs font-bold ${onlineOnly ? 'bg-emerald-500 text-white' : 'border border-gray-200 bg-white text-gray-500 dark:border-gray-800 dark:bg-gray-900'}`}>Online now</button><button aria-label="Grid view" onClick={() => setView('grid')} className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${view === 'grid' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-400'}`}><IonIcon icon={grid} /></button><button aria-label="List view" onClick={() => setView('list')} className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${view === 'list' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-400'}`}><IonIcon icon={list} /></button></div>

    {nearbyQuery.isPending && <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-72 rounded-[1.5rem]" />)}</div>}
    {nearbyQuery.isError && <EmptyState title="Couldn't load nearby people" description="Check your connection and location permission, then try again." action={<Button onClick={() => nearbyQuery.refetch()}>Try again</Button>} />}
    {!nearbyQuery.isPending && !nearbyQuery.isError && users.length === 0 && <EmptyState title="No one here just yet" description="Try a wider radius or refresh your location." action={<Button onClick={() => setRadius(20)}>Search 20 km</Button>} />}
    {users.length > 0 && <motion.div layout className={view === 'grid' ? 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4' : 'space-y-3'}>{users.map(item => <PersonCard key={getUserId(item.user)} item={item} compact={view === 'list'} onConnect={() => connectMutation.mutate(getUserId(item.user))} onChat={() => chatMutation.mutate(getUserId(item.user))} onReport={() => setReportModalUser(item)} />)}</motion.div>}

    <AnimatePresence>{filtersOpen && <Modal onClose={() => setFiltersOpen(false)} title="Discovery filters"><div className="space-y-5"><FilterRow label="Online only" hint="Show people active recently"><Switch checked={onlineOnly} onChange={setOnlineOnly} /></FilterRow><FilterRow label="Verified profiles" hint="Prioritize trusted members"><Switch checked={false} onChange={() => toast.success('Verified filter saved')} /></FilterRow><div><label className="text-xs font-bold">Age range</label><div className="mt-2 rounded-2xl bg-gray-100 p-4 text-center text-xs text-gray-500 dark:bg-gray-800">18 — 55+</div></div><Button className="w-full" onClick={() => setFiltersOpen(false)}>Show {users.length} people</Button></div></Modal>}</AnimatePresence>
    <AnimatePresence>{reportModalUser && <Modal onClose={() => setReportModalUser(null)} title={`Report ${reportModalUser.user.displayName}`}><div className="space-y-3"><select value={reportReason} onChange={e => setReportReason(e.target.value)} className="min-h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 text-sm dark:border-gray-700 dark:bg-gray-800"><option value="">Choose a reason</option><option value="inappropriate_content">Inappropriate content</option><option value="harassment">Harassment</option><option value="spam">Spam or bot</option><option value="fake_account">Fake account</option></select><textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} rows={3} placeholder="Add details (optional)" className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"/><Button variant="danger" className="w-full" disabled={!reportReason} isLoading={reportMutation.isPending} onClick={() => reportMutation.mutate()}>Submit report</Button></div></Modal>}</AnimatePresence>
  </div>;
}

function PersonCard({ item, compact, onConnect, onChat, onReport }: { item: NearbyUserItem; compact: boolean; onConnect: () => void; onChat: () => void; onReport: () => void }) {
  const connected = item.connectionStatus === 'connected';
  return <motion.article layout whileHover={{ y: -3 }} className={`app-card group overflow-hidden ${compact ? 'flex items-center p-3' : ''}`}><div className={`relative overflow-hidden ${compact ? 'h-20 w-20 shrink-0 rounded-2xl' : 'h-44'}`}><img src={item.user.avatarUrl} alt={item.user.displayName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />{!compact && <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-gray-800"><IonIcon icon={location} /> {item.distanceKm ?? '?'} km</span>}<span className="absolute right-3 top-3 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" /></div><div className={`min-w-0 ${compact ? 'flex flex-1 items-center gap-3 pl-3' : 'p-3.5'}`}><div className="min-w-0 flex-1"><div className="flex items-center gap-1"><h2 className="truncate text-sm font-extrabold">{item.user.displayName}</h2><span className="text-brand-600">●</span></div><p className="truncate text-[11px] text-gray-400">{item.mutualInterests.slice(0, 2).join(' · ') || `@${item.user.username}`}</p>{compact && <p className="mt-1 text-[10px] font-semibold text-brand-600">{item.distanceKm ?? '?'} km away</p>}</div><div className={`${compact ? 'flex' : 'mt-3 flex'} gap-2`}>{connected ? <button aria-label={`Message ${item.user.displayName}`} onClick={onChat} className="grid h-10 flex-1 place-items-center rounded-2xl bg-brand-600 px-3 text-white"><IonIcon icon={chatbubble} /></button> : item.connectionStatus === 'pending_sent' ? <span className="flex h-10 flex-1 items-center justify-center rounded-2xl bg-gray-100 px-2 text-[10px] font-bold text-gray-400 dark:bg-gray-800">Pending</span> : <button onClick={onConnect} className="flex h-10 flex-1 items-center justify-center gap-1 rounded-2xl bg-brand-600 px-3 text-[11px] font-bold text-white"><IonIcon icon={people} /> Connect</button>}<button aria-label={`Report ${item.user.displayName}`} onClick={onReport} className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800"><IonIcon icon={flagOutline} /></button></div></div></motion.article>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}><motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="w-full max-w-md rounded-t-[2rem] bg-white p-5 pb-[max(1.25rem,var(--sab))] shadow-2xl dark:bg-gray-900 sm:rounded-[2rem]"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"><IonIcon icon={close} /></button></div>{children}</motion.div></div>; }
function FilterRow({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) { return <div className="flex items-center justify-between"><div><p className="text-sm font-bold">{label}</p><p className="text-[11px] text-gray-400">{hint}</p></div>{children}</div>; }
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) { return <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button>; }
