import { ErrorResponse } from '@errors/ErrorResponse';
import { toStandardErrorFormat } from '@errors/errorCodes';

describe('ErrorResponse', () => {
  it('pushes and flattens ErrorResponse instances', () => {
    const base = new ErrorResponse('BASE_ERROR');
    const nested = new ErrorResponse(base);

    expect(nested.get()).toHaveLength(1);
    expect(nested.get()[0].code).toContain('SERVICE.');
  });

  it('handles validation error arrays with nested children', () => {
    const response = new ErrorResponse({
      errors: [
        {
          constraints: { required: 'FIELD_REQUIRED' },
          children: [
            {
              constraints: { min: 'FIELD_MIN' }
            }
          ]
        }
      ]
    });

    const errors = response.get();
    expect(errors.map(err => err.code)).toEqual([
      toStandardErrorFormat('FIELD_REQUIRED').code,
      toStandardErrorFormat('FIELD_MIN').code
    ]);
  });

  it('pushes standard error objects untouched', () => {
    const response = new ErrorResponse();
    response.push({
      code: 'SERVICE.CUSTOM',
      message: 'Custom message',
      description: 'Custom description'
    });

    expect(response.get()).toEqual([
      {
        code: 'SERVICE.CUSTOM',
        message: 'Custom message',
        description: 'Custom description'
      }
    ]);
  });

  it('pushes non-standard error objects with defaults', () => {
    const response = new ErrorResponse();
    response.push({ code: 'UNMAPPED_ERROR' });

    const [err] = response.get();
    expect(err.code).toContain('SERVICE.');
    expect(err.message.length).toBeGreaterThan(0);
    expect(err.description?.length).toBeGreaterThan(0);
  });

  it('handles raw string errors', () => {
    const response = new ErrorResponse('RAW_ERROR');
    const [err] = response.get();

    expect(err.code).toContain('SERVICE.');
    expect(err.message.length).toBeGreaterThan(0);
  });
});
