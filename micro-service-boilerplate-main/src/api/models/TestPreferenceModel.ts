import { HydratedDocument, Schema, Types, model } from '@lib/db/mongooseCompat';

export interface ITestPreference {
  user: Types.ObjectId;
  testDate?: Date;
  targetBand?: string;
  timeFrame?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TestPreferenceDocument = HydratedDocument<ITestPreference>;

const TestPreferenceSchema = new Schema<ITestPreference>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    testDate: {
      type: Date
    },
    targetBand: {
      type: String,
      trim: true
    },
    timeFrame: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export const TestPreferenceModel = model<TestPreferenceDocument>('TestPreference', TestPreferenceSchema);
