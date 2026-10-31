// API configuration for studio app

const envApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const envComposerUrl = import.meta.env.VITE_COMPOSER_URL?.trim();

// In production, VITE_API_BASE_URL must be set. We intentionally do not default to localhost.
if (import.meta.env.PROD && !envApiUrl) {
  throw new Error("CRITICAL: VITE_API_BASE_URL is missing in production build. Cannot default to localhost.");
}

export const API_BASE_URL = envApiUrl || "http://localhost:3001/api/v1";

// Composer app URL (external app)
export const COMPOSER_URL = envComposerUrl || "http://localhost:3002";

// Demo workspace ID from seed (generated: cmi2ka775000410myuj0jklq1)
export const DEMO_WORKSPACE_ID = "cmi2ka775000410myuj0jklq1";

export { features } from "../config/features";
