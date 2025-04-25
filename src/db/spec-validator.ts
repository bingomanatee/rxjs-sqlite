/**
 * Custom validator for RxDB that accepts anything
 * This follows the pattern used by the AJV validator in RxDB
 */

import type { RxJsonSchema, RxDocumentData, RxValidationError } from 'rxdb';

// Create our own implementation of the wrappedValidateStorageFactory function
// This is a simplified version of the function from rxdb/plugin-helpers.js
function wrappedValidateStorageFactory(
  getValidator: (schema: RxJsonSchema<any>) => (docData: RxDocumentData<any>) => RxValidationError[],
  validatorKey: string
) {
  // Cache validators by schema
  const validatorCache = new Map<string, (docData: RxDocumentData<any>) => RxValidationError[]>();

  // Initialize validator for a schema
  function initValidator(schema: RxJsonSchema<any>) {
    const schemaString = JSON.stringify(schema);
    if (!validatorCache.has(schemaString)) {
      validatorCache.set(schemaString, getValidator(schema));
    }
    return validatorCache.get(schemaString)!;
  }

  // Return a function that wraps the storage
  return (args: { storage: any }) => {
    return {
      ...args.storage,
      name: 'validate-' + validatorKey + '-' + args.storage.name,
      createStorageInstance: async (params: any) => {
        const instance = await args.storage.createStorageInstance(params);

        // Initialize validator
        let validator = initValidator(params.schema);

        // Wrap the bulkWrite method to validate documents
        const originalBulkWrite = instance.bulkWrite.bind(instance);
        instance.bulkWrite = (writes: any[], context: string) => {
          const errors: any[] = [];
          const validWrites: any[] = [];

          // Validate each document
          writes.forEach(write => {
            const validationErrors = validator(write.document);
            if (validationErrors.length > 0) {
              errors.push({
                status: 422,
                isError: true,
                documentId: write.document.id,
                writeRow: write,
                validationErrors,
                schema: instance.schema
              });
            } else {
              validWrites.push(write);
            }
          });

          // Continue with valid writes
          return originalBulkWrite(validWrites, context)
            .then((result: any) => {
              errors.forEach(error => {
                result.error.push(error);
              });
              return result;
            });
        };

        return instance;
      }
    };
  };
}

/**
 * Get a validator function for the given schema
 * This validator always returns an empty array (no errors)
 */
export function getValidator(schema: RxJsonSchema<any>) {
  return (docData: RxDocumentData<any>): RxValidationError[] => {
    return []; // No validation errors - accept anything
  };
}

/**
 * Create a wrapped storage factory using our custom validator
 */
export const wrappedValidateSpecStorage = wrappedValidateStorageFactory(
  getValidator,
  'spec'
);

export default wrappedValidateSpecStorage;
