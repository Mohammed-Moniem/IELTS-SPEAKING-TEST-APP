import { HydratedDocument, Schema, model } from 'mongoose';

export interface IPptDeckVersion {
  sessionKey: string;
  version: number;
  deck: unknown;
  changeSummary?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PptDeckVersionDocument = HydratedDocument<IPptDeckVersion>;

const PptDeckVersionSchema = new Schema<IPptDeckVersion>(
  {
    sessionKey: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    version: {
      type: Number,
      required: true,
      min: 1
    },
    deck: {
      type: Schema.Types.Mixed,
      required: true
    },
    changeSummary: {
      type: String,
      maxlength: 500,
      default: undefined
    }
  },
  {
    timestamps: true
  }
);

PptDeckVersionSchema.index({ sessionKey: 1, version: -1 });
PptDeckVersionSchema.index({ sessionKey: 1, version: 1 }, { unique: true });

export const PptDeckVersionModel = model<PptDeckVersionDocument>('PptDeckVersion', PptDeckVersionSchema);
