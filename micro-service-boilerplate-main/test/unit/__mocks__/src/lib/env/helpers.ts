export const constructLogMessage = jest.fn((filename: string, method: string, headers: any) => {
  return `${filename}:${method}:${headers?.urc || 'unknown'}`;
});

export const isEmptyOrNull = jest.fn((value: any): boolean => {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'object' && Object.keys(value).length === 0) ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'number' && isNaN(value))
  );
});

export const decryptValue = jest.fn(async (value: any) => {
  // For testing, just return the value as-is
  return value;
});

export const encryptValue = jest.fn(async (value: any) => {
  // For testing, just return the value as-is
  return value;
});
