import { Service } from 'typedi';

import { FeatureFlagDocument, FeatureFlagModel } from '@models/FeatureFlagModel';

@Service()
export class FeatureFlagService {
  public async getFlag(key: string): Promise<FeatureFlagDocument | null> {
    return FeatureFlagModel.findOne({ key: key.toLowerCase().trim() });
  }

  public async listFlags() {
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
