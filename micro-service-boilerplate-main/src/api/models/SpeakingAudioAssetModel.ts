import { HydratedDocument, Schema, model } from '@lib/db/mongooseCompat';

export type SpeakingAudioAssetKind =
  | 'fixed_phrase'
  | 'bank_question'
  | 'cue_card'
  | 'transition'
  | 'dynamic_follow_up';
export type SpeakingAudioAssetProvider = 'openai' | 'elevenlabs' | 'edge-tts';
export type SpeakingAudioAssetStatus = 'pending' | 'ready' | 'failed';

export interface ISpeakingAudioAsset {
  kind: SpeakingAudioAssetKind;
  cacheKey: string;
  text: string;
  voiceProfileId: string;
  provider: SpeakingAudioAssetProvider;
  storagePath: string;
  publicUrl?: string;
  mimeType?: string;
  durationSeconds?: number;
  checksum?: string;
  status: SpeakingAudioAssetStatus;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SpeakingAudioAssetDocument = HydratedDocument<ISpeakingAudioAsset>;

const SpeakingAudioAssetSchema = new Schema<ISpeakingAudioAsset>(
  {
    kind: {
      type: String,
      enum: ['fixed_phrase', 'bank_question', 'cue_card', 'transition', 'dynamic_follow_up'],
      required: true
    },
    cacheKey: {
      type: String,
      required: true,
      index: true
    },
    text: {
      type: String,
      required: true
    },
    voiceProfileId: {
      type: String,
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ['openai', 'elevenlabs', 'edge-tts'],
      required: true
    },
    storagePath: {
      type: String,
      required: true
    },
    publicUrl: {
      type: String
    },
    mimeType: {
      type: String
    },
    durationSeconds: {
      type: Number
    },
    checksum: {
      type: String
    },
    status: {
      type: String,
      enum: ['pending', 'ready', 'failed'],
      default: 'pending'
    },
    lastUsedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

export const SpeakingAudioAssetModel = model<ISpeakingAudioAsset>('SpeakingAudioAsset', SpeakingAudioAssetSchema);
