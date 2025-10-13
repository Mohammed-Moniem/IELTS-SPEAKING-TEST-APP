import { join } from 'path';

export const getOsEnv = (key: string): string => process.env[key];

export const getPath = (path: string): string =>
  process.env.NODE_ENV === 'production'
    ? join(process.cwd(), path.replace('src/', 'dist/src/').slice(0, -3) + '.js')
    : join(process.cwd(), path);

export const getPaths = (paths: Array<string>): Array<string> => paths.map(p => getPath(p));

export const getOsPath = (key: string): string => {
  const path = getOsEnv(key);
  return path && getPath(path);
};

export const getOsPaths = (key: string): Array<string> | undefined => {
  const paths = (getOsEnvArray(key) || []) as Array<string>;
  return paths.length ? getPaths(paths) : undefined;
};

export const getOsEnvArray = (key: string, delimiter: string = ','): Array<string> | boolean =>
  (process.env[key] && process.env[key].split(delimiter)) || false;

export const toNumber = (value: string): number => parseInt(value, 10);

export const toBool = (value: string): boolean => /true/i.test(value);

export const normalizePort = (port: string): number | string | boolean => {
  const parsedPort = parseInt(port, 10);
  if (isNaN(parsedPort)) {
    return port;
  }
  if (parsedPort >= 0) {
    return parsedPort;
  }
  return false;
};

export const getOsEnvBoolean = (key: string, defaultValue?: string): boolean =>
  toBool(process.env[key] || defaultValue);

export const getOsEnvObj = (key: string): any => (process.env[key] ? JSON.parse(process.env[key]) : undefined);
