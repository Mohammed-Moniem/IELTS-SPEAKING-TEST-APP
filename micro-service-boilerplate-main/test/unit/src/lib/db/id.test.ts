import { generateMongoStyleId, isMongoStyleId, normalizeMongoStyleId } from '../../../../../src/lib/db/id';

describe('id utilities', () => {
  it('generates 24-char hex IDs', () => {
    const id = generateMongoStyleId();
    expect(id).toMatch(/^[0-9a-f]{24}$/);
    expect(isMongoStyleId(id)).toBe(true);
  });

  it('normalizes IDs and rejects invalid values', () => {
    expect(normalizeMongoStyleId('ABCDEFABCDEFABCDEFABCDEF')).toBe('abcdefabcdefabcdefabcdef');
    expect(normalizeMongoStyleId('not-a-valid-id')).toBeUndefined();
    expect(normalizeMongoStyleId(undefined)).toBeUndefined();
  });
});
