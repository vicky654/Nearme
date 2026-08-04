import { Schema, model, models, Document, Types, Model } from 'mongoose';

export interface IUserSession extends Document {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  userAgent: string;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  rememberMe: boolean;
}

const userSessionSchema = new Schema<IUserSession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshTokenHash: { type: String, required: true },
  userAgent: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  rememberMe: { type: Boolean, default: false },
});

export default (models.UserSession as Model<IUserSession>) ||
  model<IUserSession>('UserSession', userSessionSchema);
