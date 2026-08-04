import { Schema, model, models, Document, Model } from 'mongoose';

export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface IPrivacySettings {
  hideOnlineStatus: boolean;
  hideDistance: boolean;
  hideProfile: boolean;
  invisibleMode: boolean;
  privateAccount: boolean;
}

export interface ILocation {
  type: 'Point';
  coordinates: [number, number];
}

export interface IUser extends Document {
  username: string;
  displayName: string;
  email: string;
  passwordHash: string | null;
  avatarUrl: string;
  bio?: string;
  gender?: Gender;
  age?: number;
  country?: string;
  city?: string;
  location?: ILocation;
  interests: string[];
  languages: string[];
  lastSeenAt: Date;
  theme: 'light' | 'dark' | 'system';
  privacy: IPrivacySettings;
  emailVerifiedAt: Date | null;
  googleId?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  passwordChangedAt: Date | null;
}

const privacySchema = new Schema<IPrivacySettings>(
  {
    hideOnlineStatus: { type: Boolean, default: false },
    hideDistance: { type: Boolean, default: false },
    hideProfile: { type: Boolean, default: false },
    invisibleMode: { type: Boolean, default: false },
    privateAccount: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null },
  avatarUrl: { type: String, required: true },
  bio: { type: String },
  gender: { type: String, enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'] },
  age: { type: Number },
  country: { type: String },
  city: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
  interests: { type: [String], default: [] },
  languages: { type: [String], default: [] },
  lastSeenAt: { type: Date, default: () => new Date() },
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  privacy: { type: privacySchema, default: () => ({}) },
  emailVerifiedAt: { type: Date, default: null },
  googleId: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
  createdAt: { type: Date, default: () => new Date() },
  passwordChangedAt: { type: Date, default: null },
});

userSchema.index({ location: '2dsphere' });

export default (models.User as Model<IUser>) || model<IUser>('User', userSchema);
