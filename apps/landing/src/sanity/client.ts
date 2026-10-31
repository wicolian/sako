import { createClient } from "next-sanity";

export const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "6kk8tx3u",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: process.env.SANITY_API_VERSION || "2024-01-01",
  token: process.env.SANITY_AUTH_TOKEN,
  useCdn: process.env.NODE_ENV === "production", // Use CDN in production for better performance
});