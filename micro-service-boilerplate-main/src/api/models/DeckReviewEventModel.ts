import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export interface IDeckReviewEvent {
  userId: Types.ObjectId;
  deckId: Types.ObjectId;
  entryType: 'collocation' | 'vocabulary' | 'resource';
  entryId: string;
  eventType: 'add' | 'remove' | 'review' | 'mastered';
  qualityScore?: number;
  intervalDays?: number;
  nextReviewAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type DeckReviewEventDocument = HydratedDocument<IDeckReviewEvent>;

const DeckReviewEventSchema = new Schema<IDeckReviewEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deckId: { type: Schema.Types.ObjectId, ref: 'UserLibraryDeck', required: true, index: true },
    entryType: { type: String, enum: ['collocation', 'vocabulary', 'resource'], required: true, index: true },
    entryId: { type: String, required: true, trim: true, index: true },
    eventType: { type: String, enum: ['add', 'remove', 'review', 'mastered'], required: true, index: true },
    qualityScore: { type: Number },
    intervalDays: { type: Number },
    nextReviewAt: { type: Date, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

DeckReviewEventSchema.index({ userId: 1, deckId: 1, createdAt: -1 });
DeckReviewEventSchema.index({ userId: 1, nextReviewAt: 1 });

export const DeckReviewEventModel = model<IDeckReviewEvent>('DeckReviewEvent', DeckReviewEventSchema);
