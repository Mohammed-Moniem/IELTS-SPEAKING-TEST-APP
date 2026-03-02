import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export interface IUserLibraryDeck {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  entryType: 'collocation' | 'vocabulary' | 'resource';
  entryIds: string[];
  source: 'manual' | 'feedback_link';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserLibraryDeckDocument = HydratedDocument<IUserLibraryDeck>;

const UserLibraryDeckSchema = new Schema<IUserLibraryDeck>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    entryType: { type: String, enum: ['collocation', 'vocabulary', 'resource'], required: true, index: true },
    entryIds: [{ type: String, trim: true }],
    source: { type: String, enum: ['manual', 'feedback_link'], default: 'manual', index: true },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

UserLibraryDeckSchema.index({ userId: 1, entryType: 1, createdAt: -1 });

export const UserLibraryDeckModel = model<IUserLibraryDeck>('UserLibraryDeck', UserLibraryDeckSchema);
