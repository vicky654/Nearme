export interface PrivacySettings {
  hideOnlineStatus: boolean;
  hideDistance: boolean;
  hideProfile: boolean;
  invisibleMode: boolean;
  privateAccount: boolean;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  bio?: string;
  gender?: string;
  age?: number;
  country?: string;
  city?: string;
  interests: string[];
  languages: string[];
  role: string;
  status: string;
  theme: 'light' | 'dark' | 'system';
  emailVerifiedAt: string | null;
  createdAt: string;
  privacy: PrivacySettings;
}
