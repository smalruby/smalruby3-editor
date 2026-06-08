/**
 * Mock for jose library (ESM-only, cannot be imported by Jest/CommonJS).
 * Tests that need Microsoft token verification should mock verifyMicrosoftIdToken directly.
 */
export const createRemoteJWKSet = jest.fn(() => jest.fn());

export const jwtVerify = jest.fn(() =>
  Promise.reject(new Error('jose mock: jwtVerify not configured')),
);
