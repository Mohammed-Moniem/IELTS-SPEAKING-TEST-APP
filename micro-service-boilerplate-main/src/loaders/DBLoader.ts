import { env } from '@env';
import { Logger } from '@lib/logger';
import mongoose from 'mongoose';

const connectDB = async () => {
  const log = new Logger(__filename);
  try {
    mongoose.set('strictQuery', true);
    const connection = await mongoose.connect(env.db.mongoURL);
    log.info(
      `Logging Service is Successfully connected to Mongodb: ${connection.connection.host} to db ${connection.connection.name}`
    );
  } catch (error: any) {
    log.error('Could not Connect to MongoDB: ', error);
  }
};

export default connectDB;
