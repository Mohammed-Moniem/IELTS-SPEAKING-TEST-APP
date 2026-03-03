describe('env mode flags', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('defaults to development mode when NODE_ENV is not set', async () => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;

    jest.resetModules();
    const { env } = await import('../../../src/env');

    expect(env.node).toBe('development');
    expect(env.isDevelopment).toBe(true);
    expect(env.isProduction).toBe(false);
    expect(env.isTest).toBe(false);
  });
});
