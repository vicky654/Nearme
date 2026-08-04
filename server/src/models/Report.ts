import { Schema, model, models, Document, Model, Types } from 'mongoose';

export interface IReport extends Document {
  reporterId: Types.ObjectId;
  reportedId: Types.ObjectId;
  reason: string;
  details?: string;
  createdAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    details: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

reportSchema.index({ reporterId: 1, reportedId: 1 });

export default (models.Report as Model<IReport>) || model<IReport>('Report', reportSchema);
