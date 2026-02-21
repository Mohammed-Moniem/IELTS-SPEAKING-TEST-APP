import { UserProfile } from '@models/UserProfileModel';

export class UserProfileRepository {
  async findByUserId(userId: string) {
    return UserProfile.findOne({ userId: userId as any });
  }

  async findByUsername(username: string) {
    return UserProfile.findOne({ username: username.toLowerCase() });
  }

  async save(profile: any) {
    return profile.save();
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>, options?: Record<string, any>) {
    return UserProfile.updateOne(filter, update, options || {});
  }
}

export const userProfileRepository = new UserProfileRepository();
