import mongoose from 'mongoose';
import connectDB from '../../../../src/loaders/DBLoader';

jest.mock('mongoose');

describe('connectDB', () => {
  it('should connect to the database successfully', async () => {
    const mockConnect = jest.fn().mockResolvedValue({
      connection: {
        host: 'localhost',
        name: 'testDB'
      }
    });
    mongoose.connect = mockConnect;

    await connectDB();

    expect(mockConnect).toHaveBeenCalledWith(expect.any(String));
  });

  it('should handle connection errors', async () => {
    const mockConnect = jest.fn().mockRejectedValue(new Error('Connection error'));
    mongoose.connect = mockConnect;

    await connectDB();

    expect(mockConnect).toHaveBeenCalledWith(expect.any(String));
  });
});
