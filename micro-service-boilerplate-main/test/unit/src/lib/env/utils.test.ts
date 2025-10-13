import { getOsEnvArray, getOsEnvBoolean, getOsEnvObj, getOsPath, getOsPaths, getPath, normalizePort, toBool, toNumber } from '@lib/env/utils';

describe('env utils helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolves production paths', () => {
    process.env.NODE_ENV = 'production';
    const productionPath = getPath('src/example/file.ts');
    expect(productionPath).toContain('dist/src/example/file.js');
  });

  it('gets OS env path and paths arrays', () => {
    process.env.NODE_ENV = 'development';
    process.env.SINGLE_PATH = 'src/index.ts';
    process.env.MULTI_PATH = 'src/a.ts,src/b.ts';

    const single = getOsPath('SINGLE_PATH');
    const multiple = getOsPaths('MULTI_PATH');

    expect(single).toContain('src/index.ts');
    expect(multiple).toHaveLength(2);
  });

  it('parses environment arrays and booleans', () => {
    process.env.ARRAY = 'a,b,c';
    process.env.FLAG = 'true';

    expect(getOsEnvArray('ARRAY')).toEqual(['a', 'b', 'c']);
    expect(getOsEnvArray('MISSING')).toBe(false);
    expect(toBool('TRUE')).toBe(true);
    expect(getOsEnvBoolean('FLAG')).toBe(true);
  });

  it('normalizes numeric and string ports', () => {
    expect(normalizePort('3000')).toBe(3000);
    expect(normalizePort('namedPipe')).toBe('namedPipe');
    expect(normalizePort('-1')).toBe(false);
  });

  it('parses numbers and JSON objects', () => {
    process.env.JSON_VALUE = JSON.stringify({ key: 'value' });

    expect(toNumber('42')).toBe(42);
    expect(getOsEnvObj('JSON_VALUE')).toEqual({ key: 'value' });
    expect(getOsEnvObj('MISSING')).toBeUndefined();
  });
});
