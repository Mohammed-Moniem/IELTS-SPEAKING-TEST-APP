import { IUser, UserModel } from '@models/UserModel';

export class UserRepository {
  async findByEmail(email: string) {
    return UserModel.findOne({ email });
  }

  async findByEmailWithSecrets(email: string) {
    return UserModel.findOne({ email }).select('+password +refreshTokens');
  }

  async findById(id: string) {
    return UserModel.findById(id);
  }

  async findByIdWithRefreshTokens(id: string) {
    return UserModel.findById(id).select('+refreshTokens');
  }

  async create(payload: Partial<IUser>) {
    return UserModel.create(payload as any);
  }

  async deleteById(id: string) {
    return UserModel.deleteOne({ _id: id });
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>, options?: Record<string, any>) {
    return UserModel.updateOne(filter, update, options || {});
  }
}

export const userRepository = new UserRepository();
