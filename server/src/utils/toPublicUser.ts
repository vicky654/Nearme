import { IUser, IPrivacySettings } from '../models/User';

export interface PublicUser {
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
  theme: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  privacy: IPrivacySettings;
}

export function toPublicUser(user: IUser): PublicUser {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    gender: user.gender,
    age: user.age,
    country: user.country,
    city: user.city,
    interests: user.interests,
    languages: user.languages,
    role: user.role,
    status: user.status,
    theme: user.theme,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    privacy: user.privacy,
  };
}
