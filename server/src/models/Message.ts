import { Schema, model, models, Document, Model, Types } from 'mongoose';

export type MessageStatus = 'sent' | 'delivered' | 'seen';

export interface IMessageAttachment {
  type: 'image' | 'audio' | 'file';
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  clientId?: string;
  content: string;
  status: MessageStatus;
  readBy: Types.ObjectId[];
  replyTo?: Types.ObjectId;
  reactions: Array<{ emoji: string; userId: Types.ObjectId }>;
  attachments: IMessageAttachment[];
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: String, trim: true, maxlength: 100 },
    content: { type: String, required: true, maxlength: 4000 },
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    reactions: [{ emoji: { type: String, required: true, maxlength: 16 }, userId: { type: Schema.Types.ObjectId, ref: 'User', required: true } }],
    attachments: [{
      type: { type: String, enum: ['image', 'audio', 'file'], required: true },
      url: { type: String, required: true, maxlength: 2048 },
      name: { type: String, required: true, maxlength: 255 },
      mimeType: { type: String, required: true, maxlength: 100 },
      size: { type: Number, required: true, min: 0, max: 8 * 1024 * 1024 },
    }],
    editedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index(
  { senderId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);

export default (models.Message as Model<IMessage>) || model<IMessage>('Message', messageSchema);
