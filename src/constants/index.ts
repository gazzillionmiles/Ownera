/**
 * src/constants/index.ts
 * Application-wide constants driven by environment variables.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Ownera';
export const APP_TAGLINE = 'Buy together. Pay less.';
export const APP_DESCRIPTION = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Collective buying for residential communities.';
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@ownera.in';

