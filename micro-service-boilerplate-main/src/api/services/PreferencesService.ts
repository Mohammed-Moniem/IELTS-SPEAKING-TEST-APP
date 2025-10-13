import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { TestPreferenceModel } from '@models/TestPreferenceModel';
import { Service } from 'typedi';

interface PreferencesPayload {
  testDate?: string;
  targetBand?: string;
  timeFrame?: string;
}

@Service()
export class PreferencesService {
  private log = new Logger(__filename);

  public async getPreferences(userId: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'getPreferences', headers);
    const preferences = await TestPreferenceModel.findOne({ user: userId });
    this.log.debug(`${logMessage} :: Returning preferences for user ${userId}`);
    return preferences;
  }

  public async upsertPreferences(userId: string, payload: PreferencesPayload, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'upsertPreferences', headers);

    const update = {
      ...(payload.testDate ? { testDate: new Date(payload.testDate) } : {}),
      ...(payload.targetBand ? { targetBand: payload.targetBand } : {}),
      ...(payload.timeFrame ? { timeFrame: payload.timeFrame } : {})
    };

    const preferences = await TestPreferenceModel.findOneAndUpdate(
      { user: userId },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    this.log.info(`${logMessage} :: Upserted preferences for user ${userId}`);
    return preferences;
  }
}
