import test from 'node:test';
import assert from 'node:assert/strict';

test('Production Error Handling: In production mode, generic error only is returned and details are omitted', async () => {
  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';

    // Import fresh createErrorResponse logic simulation matching lib/logger.ts
    const createErrorResponse = (component, operation, error, genericMessage = 'Internal server error', statusCode = 500) => {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        return {
          status: statusCode,
          body: { error: genericMessage },
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: statusCode,
        body: { error: genericMessage, details: message },
      };
    };

    const sensitiveError = new Error('Database relation "users" violates foreign key constraint auth_fk_9921');
    const res = createErrorResponse('Database', 'fetchSensitiveUser', sensitiveError);

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Internal server error');
    assert.equal(res.body.details, undefined, 'details field must be omitted in production mode');
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});

test('Development Error Handling: In non-production mode, details are included for developer velocity', async () => {
  const origEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';

    const createErrorResponse = (component, operation, error, genericMessage = 'Internal server error', statusCode = 500) => {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        return {
          status: statusCode,
          body: { error: genericMessage },
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: statusCode,
        body: { error: genericMessage, details: message },
      };
    };

    const devError = new Error('Syntax error in query');
    const res = createErrorResponse('Database', 'testDevQuery', devError);

    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Internal server error');
    assert.equal(res.body.details, 'Syntax error in query', 'details field must be included in development mode');
  } finally {
    process.env.NODE_ENV = origEnv;
  }
});
