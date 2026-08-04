import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface IBlockedUser extends Document {
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  createdAt: Date;
}

const blockedUserSchema = new Schema<IBlockedUser>(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blockedId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

blockedUserSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export default (models.BlockedUser as Model<IBlockedUser>) || model<IBlockedUser>('BlockedUser', blockedUserSchema);
