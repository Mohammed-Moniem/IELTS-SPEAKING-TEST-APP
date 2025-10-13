import { errors, toStandardErrorCode, toStandardErrorFormat } from '@errors/errorCodes';

describe('errorCodes utilities', () => {
  it('should format unknown codes with default metadata', () => {
    const formatted = toStandardErrorFormat('UNKNOWN_CODE');

    expect(formatted.code).toMatch(/SERVICE\./);
    expect(formatted.message.length).toBeGreaterThan(0);
    expect(formatted.description?.length).toBeGreaterThan(0);
  });

  it('should hydrate missing message and description from errObj', () => {
    (errors as any).TEST_EMPTY = { code: 'EMPTY', message: '', description: '' };

    const formatted = toStandardErrorFormat('TEST_EMPTY', {
      message: 'custom message',
      description: 'custom description'
    });

    expect(formatted.message).toBe('custom message');
    expect(formatted.description).toBe('custom description');
  });

  it('should preserve existing formatted codes', () => {
    const existing = toStandardErrorCode('SERVICE.EXISTING');
    expect(existing).toBe('SERVICE.EXISTING');
  });
});
