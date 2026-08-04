import { Schema, model, models, Document, Model, Types } from 'mongoose';

export type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'new_message'
  | 'system';

export interface INotification extends Document {
  receiverId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>({
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['friend_request_received', 'friend_request_accepted', 'new_message', 'system'],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedId: { type: String },
  isRead: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: () => new Date() },
});

notificationSchema.index({ receiverId: 1, createdAt: -1 });

export default (models.Notification as Model<INotification>) ||
  model<INotification>('Notification', notificationSchema);
