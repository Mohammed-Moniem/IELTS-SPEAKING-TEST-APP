import { Service } from 'typedi';

import { FeatureFlagDocument, FeatureFlagModel } from '@models/FeatureFlagModel';

const DEFAULT_WEB_UI_FLAGS: Array<{
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
}> = [
  {
    key: 'web_ui_v2',
    description: 'Master switch for redesigned web UI surfaces.',
    enabled: false,
    rolloutPercentage: 100
  },
  {
    key: 'web_ui_v2_marketing',
    description: 'Enable redesigned marketing experience.',
    enabled: false,
    rolloutPercentage: 100
  },
  {
    key: 'web_ui_v2_learner',
    description: 'Enable redesigned learner app experience.',
    enabled: false,
    rolloutPercentage: 100
  },
  {
    key: 'web_ui_v2_admin',
    description: 'Enable redesigned admin workspace experience.',
    enabled: false,
    rolloutPercentage: 100
  }
];

@Service()
export class FeatureFlagService {
  private async ensureDefaultFlags() {
    const keys = DEFAULT_WEB_UI_FLAGS.map(flag => flag.key);
    const existing = await FeatureFlagModel.find({ key: { $in: keys } }).select('key').lean();
    const existingKeys = new Set(existing.map(flag => flag.key));
    const missingFlags = DEFAULT_WEB_UI_FLAGS.filter(flag => !existingKeys.has(flag.key));

    if (missingFlags.length === 0) {
      return;
    }

    try {
      await FeatureFlagModel.insertMany(missingFlags, { ordered: false });
    } catch (error: any) {
      // Ignore duplicate races across concurrent instances and continue.
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  public async getFlag(key: string): Promise<FeatureFlagDocument | null> {
    return FeatureFlagModel.findOne({ key: key.toLowerCase().trim() });
  }

  public async listFlags() {
    await this.ensureDefaultFlags();
    return FeatureFlagModel.find({}).sort({ key: 1 });
  }

  public async upsertFlag(input: {
    key: string;
    enabled?: boolean;
    rolloutPercentage?: number;
    description?: string;
  }) {
    const update: Record<string, unknown> = {};

    if (typeof input.enabled === 'boolean') {
      update.enabled = input.enabled;
    }

    if (typeof input.rolloutPercentage === 'number') {
      update.rolloutPercentage = input.rolloutPercentage;
    }

    if (typeof input.description === 'string') {
      update.description = input.description;
    }

    return FeatureFlagModel.findOneAndUpdate(
      { key: input.key.toLowerCase().trim() },
      {
        $set: update,
        $setOnInsert: {
          key: input.key.toLowerCase().trim()
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );
  }

  public async isEnabled(key: string) {
    const flag = await this.getFlag(key);
    return flag?.enabled || false;
  }
}
