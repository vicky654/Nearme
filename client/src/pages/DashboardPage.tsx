import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IonIcon } from '@ionic/react';
import { arrowForward, chatbubbleEllipses, compass, flash, location, people, personAdd, sparkles } from 'ionicons/icons';
import { useAuthStore } from '../store/authStore';
import { getNearbyUsers, getFriendRequests } from '../api/friendApi';
import { getConversations } from '../api/chatApi';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { getUserId } from '../types/user';

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const nearbyQuery = useQuery({ queryKey: ['nearby-preview'], queryFn: () => getNearbyUsers(20) });
  const requestsQuery = useQuery({ queryKey: ['friend-requests-preview'], queryFn: getFriendRequests });
  const chatsQuery = useQuery({ queryKey: ['conversations-preview'], queryFn: getConversations });
  const nearby = nearbyQuery.data?.users.slice(0, 6) ?? [];
  const requests = requestsQuery.data?.incoming.slice(0, 3) ?? [];
  const chats = chatsQuery.data?.conversations.slice(0, 4) ?? [];
  const firstName = user?.displayName?.split(' ')[0] ?? 'Explorer';

  return (
    <div className="dashboard-page page-shell space-y-7">
      <motion.section {...fade} className="relative overflow-hidden rounded-[2rem] bg-[#20264c] p-5 text-white shadow-[0_24px_55px_-25px_rgba(40,48,105,.75)] sm:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/40 blur-2xl" /><div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/80 backdrop-blur"><IonIcon icon={sparkles} /> Your daily circle</span>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-.035em] sm:text-4xl">Hello, {user?.displayName ?? 'Explorer'}!</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-indigo-100/80">New faces, familiar friends, and conversations worth having—all close by.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button onClick={() => navigate('/nearby')} className="bg-white !text-[#28305d] hover:bg-indigo-50"><IonIcon icon={compass} /> Discover nearby<span className="sr-only">📍 Discover Nearby</span></Button>
            <Button variant="secondary" onClick={() => navigate('/chat')} className="border-white/15 bg-white/10 text-white hover:bg-white/15"><IonIcon icon={chatbubbleEllipses} /> Open chats<span className="sr-only">💬 Open Chat</span></Button>
          </div>
        </div>
        <div className="absolute bottom-6 right-7 hidden items-end lg:flex">{nearby.slice(0, 3).map((item, i) => <img key={getUserId(item.user)} src={item.user.avatarUrl} alt="" className={`${i === 1 ? 'h-20 w-20' : 'h-16 w-16'} -ml-3 rounded-[1.4rem] border-4 border-[#353d70] object-cover shadow-xl`} />)}</div>
      </motion.section>

      <section aria-label={`Good afternoon, ${firstName}`}>
        <div className="mb-3 flex items-end justify-between"><div><p className="eyebrow">Live snapshot</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">Your neighborhood</h2></div><span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live</span></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [location, nearbyQuery.data?.users.length ?? 0, 'people nearby', 'bg-brand-50 text-brand-600 dark:bg-brand-500/10'],
            [personAdd, requestsQuery.data?.incoming.length ?? 0, 'new requests', 'bg-rose-50 text-rose-500 dark:bg-rose-500/10'],
            [chatbubbleEllipses, chatsQuery.data?.conversations.length ?? 0, 'active chats', 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'],
            [flash, 'Online', 'ready to connect', 'bg-amber-50 text-amber-600 dark:bg-amber-500/10'],
          ].map(([icon, value, label, tone]) => <motion.div whileHover={{ y: -3 }} key={String(label)} className="app-card flex items-center gap-3 p-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}><IonIcon icon={String(icon)} className="text-xl" /></span><div><strong className="block text-lg font-extrabold leading-none text-gray-900 dark:text-white">{value}</strong><span className="mt-1 block text-[11px] font-medium text-gray-400">{label}</span></div></motion.div>)}
        </div>
      </section>

      <div className="grid gap-7 lg:grid-cols-[1.55fr_.85fr]">
        <div className="space-y-7">
          <section><SectionTitle eyebrow="Around you" title="People you may vibe with" to="/nearby" />
            {nearbyQuery.isPending ? <div className="flex gap-3 overflow-hidden">{[1,2,3].map(i => <Skeleton key={i} className="h-56 min-w-[175px] rounded-[1.5rem]" />)}</div> : nearby.length === 0 ? <CompactEmpty text="No one nearby yet. Update your location to start discovering." /> : <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">{nearby.map(item => <motion.button whileTap={{ scale: .98 }} key={getUserId(item.user)} onClick={() => navigate('/nearby')} className="app-card min-w-[176px] snap-start overflow-hidden text-left"><div className="relative h-32"><img src={item.user.avatarUrl} alt={item.user.displayName} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />{item.distanceKm !== null && <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-gray-800">{item.distanceKm} km</span>}</div><div className="p-3"><div className="flex items-center gap-1.5"><h3 className="truncate text-sm font-bold">{item.user.displayName}</h3><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /></div><p className="mt-0.5 truncate text-[11px] text-gray-400">{item.mutualInterests.slice(0,2).join(' · ') || `@${item.user.username}`}</p></div></motion.button>)}</div>}
          </section>

          <section><SectionTitle eyebrow="Keep talking" title="Recent conversations" to="/chat" />
            <div className="app-card divide-y divide-gray-100 overflow-hidden dark:divide-gray-800">{chats.length === 0 ? <CompactEmpty text="Your conversations will appear here." /> : chats.map(c => <button key={c._id} onClick={() => navigate('/chat', { state: { conversationId: c._id } })} className="flex min-h-[72px] w-full items-center gap-3 px-4 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/50"><div className="relative"><img src={c.recipient?.avatarUrl} alt={c.recipient?.displayName} className="h-12 w-12 rounded-2xl object-cover" /><span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-900" /></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h3 className="truncate text-sm font-bold">{c.recipient?.displayName}</h3><time className="text-[10px] text-gray-400">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time></div><p className="mt-1 truncate text-xs text-gray-400">{c.lastMessage?.content || 'Start the conversation'}</p></div>{c.unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold leading-5 text-white">{c.unreadCount}</span>}</button>)}</div>
          </section>
        </div>

        <section><SectionTitle eyebrow="New connections" title="Friend requests" to="/friends" /><div className="app-card p-3">{requests.length === 0 ? <CompactEmpty text="You're all caught up." /> : requests.map(req => <div key={req.id} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800"><img src={req.user.avatarUrl} alt={req.user.displayName} className="h-12 w-12 rounded-2xl object-cover" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">{req.user.displayName}</h3><p className="truncate text-[11px] text-gray-400">wants to connect</p></div><Button size="sm" onClick={() => navigate('/friends')}>Review</Button></div>)}</div>
          <Link to="/search" className="mt-4 flex items-center gap-4 rounded-[1.5rem] bg-gradient-to-r from-violet-100 to-brand-50 p-4 text-violet-900 dark:from-violet-950/50 dark:to-brand-500/10 dark:text-violet-100"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70 text-xl dark:bg-white/10"><IonIcon icon={people} /></span><div className="flex-1"><strong className="text-sm">Grow your circle</strong><p className="text-[11px] opacity-65">Search by interests and city</p></div><IonIcon icon={arrowForward} /></Link>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, to }: { eyebrow: string; title: string; to: string }) { return <div className="mb-3 flex items-end justify-between"><div><p className="eyebrow">{eyebrow}</p><h2 className="mt-1 text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">{title}</h2></div><Link to={to} className="flex items-center gap-1 text-xs font-bold text-brand-600">See all <IonIcon icon={arrowForward} /></Link></div>; }
function CompactEmpty({ text }: { text: string }) { return <div className="px-5 py-9 text-center"><span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">✦</span><p className="text-xs leading-5 text-gray-400">{text}</p></div>; }
