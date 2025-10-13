import { constructLogMessage, decrypt, decryptValue, encrypt, encryptValue, getAlgorithmAES256CBC, isEmptyOrNull } from '@lib/env/helpers';

jest.mock('@env', () => ({
  env: {
    constants: {
      encryption: {
        key: Buffer.from('0123456789abcdef0123456789abcdef').toString('base64'),
        iv: Buffer.from('0123456789abcdef').toString('base64'),
        algorithm: 'aes-256-cbc'
      }
    }
  }
}));

describe('env helpers', () => {
  it('detects empty values correctly', () => {
    expect(isEmptyOrNull(null)).toBe(true);
    expect(isEmptyOrNull('')).toBe(true);
    expect(isEmptyOrNull({})).toBe(true);
    expect(isEmptyOrNull([])).toBe(true);
    expect(isEmptyOrNull(NaN)).toBe(true);
    expect(isEmptyOrNull('value')).toBe(false);
    expect(isEmptyOrNull({ key: 'value' })).toBe(false);
  });

  it('constructs log message with nested headers', () => {
    const message = constructLogMessage('file', 'method', {
      urc: '123',
      meta: {
        user: 'tester'
      }
    } as any);

    expect(message).toContain('urc :: 123');
    expect(message).toContain('meta.user :: tester');
  });

  it('selects algorithm based on key length', () => {
    const key128 = Buffer.alloc(16).toString('base64');
    const key192 = Buffer.alloc(24).toString('base64');

    expect(getAlgorithmAES256CBC(key128)).toBe('aes-128-cbc');
    expect(getAlgorithmAES256CBC(key192)).toBe('aes-192-cbc');
    expect(getAlgorithmAES256CBC(Buffer.alloc(32).toString('base64'))).toBe('aes-256-cbc');
  });

  it('encrypts and decrypts values symmetrically', () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
    const iv = Buffer.from('abcdef9876543210').toString('base64');
    const plainText = 'secret-data';

    const cipher = encrypt(plainText, key, iv);
    expect(typeof cipher).toBe('string');

    const decrypted = decrypt(cipher, key, iv);
    expect(decrypted).toBe(plainText);
  });

  it('wraps encryption helpers using env defaults', () => {
    const cipher = encryptValue('wrapped');
    const plain = decryptValue(cipher);

    expect(plain).toBe('wrapped');
  });

  it('throws when encryption key length is invalid', () => {
    const badKey = Buffer.from('short').toString('base64');

    expect(() => getAlgorithmAES256CBC(badKey)).toThrow('Invalid key length');
  });
});
