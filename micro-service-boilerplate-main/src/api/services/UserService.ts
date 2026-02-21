import { CSError } from '@errors/CSError';
import { CODES, HTTP_STATUS_CODES } from '@errors/errorCodeConstants';
import { IRequestHeaders } from '@interfaces/IRequestHeaders';
import { userRepository } from '@lib/db/repositories';
import { constructLogMessage } from '@lib/env/helpers';
import { Logger } from '@lib/logger';
import { Service } from 'typedi';

interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

@Service()
export class UserService {
  private log = new Logger(__filename);

  public async getProfile(userId: string, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'getProfile', headers);
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    this.log.debug(`${logMessage} :: Returning profile for user ${userId}`);
    return user;
  }

  public async updateProfile(userId: string, payload: UpdateUserPayload, headers: IRequestHeaders) {
    const logMessage = constructLogMessage(__filename, 'updateProfile', headers);
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new CSError(HTTP_STATUS_CODES.NOT_FOUND, CODES.NotFound, 'User not found');
    }

    if (payload.firstName !== undefined) user.firstName = payload.firstName;
    if (payload.lastName !== undefined) user.lastName = payload.lastName;
    if (payload.phone !== undefined) user.phone = payload.phone;

    await user.save();
    this.log.info(`${logMessage} :: Updated profile for user ${userId}`);
    return user;
  }
}
