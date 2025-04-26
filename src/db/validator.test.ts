import { describe, it, expect, beforeAll } from 'vitest';
import wrappedValidateSpecStorage, { getValidator } from './spec-validator';

describe('RxDB Custom Validator', () => {
  // Test that the validator has the correct structure
  it('should have the correct interface', () => {
    expect(wrappedValidateSpecStorage).toBeDefined();
    expect(typeof wrappedValidateSpecStorage).toBe('function');
    expect(getValidator).toBeDefined();
    expect(typeof getValidator).toBe('function');
  });

  // Test that the validator function returns an empty array (no errors)
  it('should return an empty array for any input', () => {
    const schema = {
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['id']
    };

    const validatorFn = getValidator(schema);
    expect(validatorFn).toBeDefined();
    expect(typeof validatorFn).toBe('function');

    const validData = {
      id: '123',
      name: 'Test'
    };

    const invalidData = {
      name: 'Test'
    };

    // Both should return empty arrays (no validation errors)
    expect(validatorFn(validData)).toEqual([]);
    expect(validatorFn(invalidData)).toEqual([]);
  });

  // Test that the validator handles nullable fields correctly
  it('should handle nullable fields correctly', () => {
    const schema = {
      version: 0,
      primaryKey: 'id',
      type: 'object',
      properties: {
        id: { type: 'string' },
        description: { type: ['string', 'null'] }
      },
      required: ['id']
    };

    const validatorFn = getValidator(schema);

    const validDataWithNull = {
      id: '123',
      description: null
    };

    const validDataWithString = {
      id: '123',
      description: 'Test description'
    };

    // Both should return empty arrays (no validation errors)
    expect(validatorFn(validDataWithNull)).toEqual([]);
    expect(validatorFn(validDataWithString)).toEqual([]);
  });
});
