// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.

// Only initialize Sentry if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    // Use require for synchronous loading to avoid build-time resolution issues
    const Sentry = require('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      
      // Adjust this value in production, or use tracesSampler for greater control
      tracesSampleRate: 1.0,
      
      // Setting this option to true will print useful information to the console while you're setting up Sentry.
      debug: false,
    });
  } catch (error) {
    // Sentry not available, skip initialization silently
    // This is expected in local development when Sentry DSN is not set
  }
}

