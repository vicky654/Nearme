import { GoogleAuth } from 'google-auth-library';
import User from '../models/User';
import { env } from '../config/env';

const FIREBASE_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const googleAuth = env.FCM_PROJECT_ID ? new GoogleAuth({ scopes: [FIREBASE_SCOPE] }) : null;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string | undefined>;
}

function isUnregisteredToken(errorPayload: any) {
  return errorPayload?.error?.details?.some(
    (detail: any) => detail?.['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError'
      && detail?.errorCode === 'UNREGISTERED'
  );
}

export async function sendPushNotification(userId: string, payload: PushPayload): Promise<void> {
  if (!env.FCM_PROJECT_ID || !googleAuth) return;
  const user = await User.findById(userId).select('+pushTokens');
  const pushTokens = [...new Set(user?.pushTokens || [])];
  if (pushTokens.length === 0) return;

  const authClient = await googleAuth.getClient();
  const accessTokenResponse = await authClient.getAccessToken();
  const accessToken = typeof accessTokenResponse === 'string' ? accessTokenResponse : accessTokenResponse?.token;
  if (!accessToken) return;

  const data = Object.fromEntries(Object.entries(payload.data || {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FCM_PROJECT_ID)}/messages:send`;

  await Promise.all(pushTokens.map(async (token) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: payload.title, body: payload.body },
            data,
            android: { priority: 'high', notification: { sound: 'default', channel_id: 'messages' } },
            apns: { payload: { aps: { sound: 'default', 'content-available': 1 } } },
          },
        }),
      });
      if (response.ok) return;
      const errorPayload = await response.json().catch(() => null);
      if (isUnregisteredToken(errorPayload)) {
        await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
      }
    } catch {
      // Socket/in-app delivery has already succeeded; push is best effort.
    }
  }));
}
