import { env } from '../../../../src/env';
import { initializeSupabasePersistence } from '../../../../src/lib/db/bootstrap';
import { checkSupabaseStorageConnection } from '../../../../src/lib/db/supabaseClient';
import connectDB from '../../../../src/loaders/DBLoader';

jest.mock('../../../../src/lib/db/bootstrap', () => ({
  initializeSupabasePersistence: jest.fn()
}));

jest.mock('../../../../src/lib/db/supabaseClient', () => ({
  checkSupabaseStorageConnection: jest.fn()
}));

jest.mock('../../../../src/env', () => ({
  env: {
    storage: {
      provider: 'supabase'
    }
  }
}));

describe('connectDB', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (env as any).storage.provider = 'supabase';
  });

  it('initializes Supabase persistence and storage checks', async () => {
    (initializeSupabasePersistence as jest.Mock).mockResolvedValue(undefined);
    (checkSupabaseStorageConnection as jest.Mock).mockResolvedValue(undefined);

    await connectDB();

    expect(initializeSupabasePersistence).toHaveBeenCalledTimes(1);
    expect(checkSupabaseStorageConnection).toHaveBeenCalledTimes(1);
  });

  it('skips storage check when provider is not supabase', async () => {
    (env as any).storage.provider = 's3';
    (initializeSupabasePersistence as jest.Mock).mockResolvedValue(undefined);

    await connectDB();

    expect(initializeSupabasePersistence).toHaveBeenCalledTimes(1);
    expect(checkSupabaseStorageConnection).not.toHaveBeenCalled();
  });

  it('handles bootstrap errors gracefully', async () => {
    (initializeSupabasePersistence as jest.Mock).mockRejectedValue(new Error('bootstrap failed'));

    await connectDB();

    expect(initializeSupabasePersistence).toHaveBeenCalledTimes(1);
  });
});
