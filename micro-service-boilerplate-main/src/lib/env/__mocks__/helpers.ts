export const constructLogMessage = (filename: string, method: string, headers: any) => {
  return `${filename}:${method}:${headers?.urc || 'unknown'}`;
};

export const isEmptyOrNull = (value: any): boolean => {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'object' && value !== null && Object.keys(value).length === 0) ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'number' && isNaN(value))
  );
};
