import { IonIcon } from '@ionic/react';
import { locationOutline, lockClosedOutline } from 'ionicons/icons';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { useLocationStore } from '../../store/locationStore';

const STATUS_LABEL = {
  unknown: 'Checking…',
  prompt: 'Not requested',
  granted: 'Allowed',
  denied: 'Denied',
  blocked: 'Blocked',
} as const;

export function LocationPermissionCard() {
  const { status, request, openSettings, isNative } = useLocationPermission();
  const lastSentAt = useLocationStore((state) => state.lastSentAt);

  if (status === 'granted') return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="location-permission-card"
      className="app-card p-6 text-center"
    >
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10">
        <IonIcon icon={status === 'blocked' ? lockClosedOutline : locationOutline} className="text-2xl" />
      </span>
      <h2 className="mt-4 text-lg font-extrabold">See who's nearby</h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        NearMe uses your location to show people near you and how far away they are.
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        Status: {STATUS_LABEL[status]}
      </span>
      {lastSentAt && (
        <p className="mt-1 text-[11px] text-gray-400">Last updated {new Date(lastSentAt).toLocaleTimeString()}</p>
      )}
      <div className="mt-5">
        {status === 'blocked' && isNative && <Button onClick={() => void openSettings()}>Open Settings</Button>}
        {status === 'blocked' && !isNative && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Location is blocked in your browser. Click the lock icon in your address bar → Site settings → Location → Allow, then refresh this page.
          </p>
        )}
        {status !== 'blocked' && <Button onClick={() => void request()}>Allow Location</Button>}
      </div>
    </motion.section>
  );
}
