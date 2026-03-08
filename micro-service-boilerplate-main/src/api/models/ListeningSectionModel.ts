import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';
import { ReadingQuestionType, IReadingAnswerSpec } from './ReadingTestModel';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ListeningSectionType = 's1' | 's2' | 's3' | 's4';

export interface IListeningSpeaker {
  label: string;
  voice: string;
  gender: 'male' | 'female';
}

export interface ITranscriptSegment {
  speaker: string;
  text: string;
}

export interface IListeningSectionQuestion {
  questionId: string;
  sectionId?: ListeningSectionType;
  type: ReadingQuestionType;
  prompt: string;
  instructions?: string;
  groupId?: string;
  options?: string[];
  correctAnswer?: string;
  answerSpec?: IReadingAnswerSpec;
  explanation?: string;
}

export interface IListeningSection {
  sectionType: ListeningSectionType;
  title: string;
  topic: string;
  context: string;
  speakers: IListeningSpeaker[];
  transcript: string;
  transcriptSegments: ITranscriptSegment[];
  audioUrl?: string;
  audioDurationSeconds?: number;
  questions: IListeningSectionQuestion[];
  questionTypes: string[];
  fingerprint: string;
  source: 'pipeline' | 'manual';
  qualityTier: 'gen_v1';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ListeningSectionDocument = HydratedDocument<IListeningSection>;

/* ------------------------------------------------------------------ */
/*  Sub-schemas                                                       */
/* ------------------------------------------------------------------ */

const SpeakerSchema = new Schema<IListeningSpeaker>(
  {
    label: { type: String, required: true },
    voice: { type: String, required: true },
    gender: { type: String, enum: ['male', 'female'], required: true }
  },
  { _id: false }
);

const TranscriptSegmentSchema = new Schema<ITranscriptSegment>(
  {
    speaker: { type: String, required: true },
    text: { type: String, required: true }
  },
  { _id: false }
);

const ListeningSectionAnswerSpecSchema = new Schema<IReadingAnswerSpec>(
  {
    kind: { type: String, enum: ['single', 'multi', 'ordered', 'map'], required: true },
    value: { type: Schema.Types.Mixed, required: true },
    caseSensitive: { type: Boolean, default: false },
    maxWords: { type: Number }
  },
  { _id: false }
);

const ListeningSectionQuestionSchema = new Schema<IListeningSectionQuestion>(
  {
    questionId: { type: String, required: true },
    sectionId: { type: String, enum: ['s1', 's2', 's3', 's4'] },
    type: {
      type: String,
      enum: [
        'multiple_choice',
        'multiple_choice_single',
        'multiple_choice_multiple',
        'true_false_not_given',
        'yes_no_not_given',
        'matching_headings',
        'matching_information',
        'matching_features',
        'matching_sentence_endings',
        'sentence_completion',
        'summary_completion',
        'note_table_flow_completion',
        'diagram_label_completion',
        'short_answer'
      ],
      required: true
    },
    prompt: { type: String, required: true },
    instructions: { type: String },
    groupId: { type: String },
    options: { type: [String], default: [] },
    correctAnswer: { type: String },
    answerSpec: { type: ListeningSectionAnswerSpecSchema },
    explanation: { type: String }
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/*  Main schema                                                       */
/* ------------------------------------------------------------------ */

const ListeningSectionSchema = new Schema<IListeningSection>(
  {
    sectionType: {
      type: String,
      enum: ['s1', 's2', 's3', 's4'],
      required: true
    },
    title: { type: String, required: true },
    topic: { type: String, required: true },
    context: { type: String, required: true },
    speakers: { type: [SpeakerSchema], default: [] },
    transcript: { type: String, required: true },
    transcriptSegments: { type: [TranscriptSegmentSchema], default: [] },
    audioUrl: { type: String },
    audioDurationSeconds: { type: Number },
    questions: { type: [ListeningSectionQuestionSchema], default: [] },
    questionTypes: { type: [String], default: [] },
    fingerprint: { type: String, required: true },
    source: { type: String, enum: ['pipeline', 'manual'], default: 'pipeline' },
    qualityTier: { type: String, enum: ['gen_v1'], default: 'gen_v1' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ListeningSectionSchema.index({ sectionType: 1, active: 1, qualityTier: 1 });
ListeningSectionSchema.index({ fingerprint: 1 }, { unique: true });

export const ListeningSectionModel = model<IListeningSection>('ListeningSection', ListeningSectionSchema);
