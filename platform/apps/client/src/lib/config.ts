// API configuration for client app

const envApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const envComposerUrl = import.meta.env.VITE_COMPOSER_URL?.trim();
const envStrategyCallUrl = import.meta.env.VITE_STRATEGY_CALL_URL?.trim();
const envSupportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim();

// In production, VITE_API_BASE_URL must be set. We intentionally do not default to localhost.
if (import.meta.env.PROD && !envApiUrl) {
  throw new Error("CRITICAL: VITE_API_BASE_URL is missing in production build. Cannot default to localhost.");
}

export const API_BASE_URL = envApiUrl || "http://localhost:3001/api/v1";

// Composer app URL (external app)
export const COMPOSER_URL = envComposerUrl || "http://localhost:3002";

// Strategy call booking URL for Enterprise users (Cal.com, Calendly, etc)
export const STRATEGY_CALL_URL = envStrategyCallUrl || "";

// Support email for contact links
export const SUPPORT_EMAIL = envSupportEmail || "support@trysako.com";

export { features } from "../config/features";
