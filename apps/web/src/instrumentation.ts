export async function register() {
  // Only load Sentry instrumentation if DSN is configured
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      await import('./instrumentation-server' as string);
    } catch (error) {
      console.warn('Failed to load server instrumentation:', error);
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    try {
      await import('./instrumentation-edge' as string);
    } catch (error) {
      console.warn('Failed to load edge instrumentation:', error);
    }
  }
  
  // Client-side config is loaded automatically via instrumentation-client.ts
  // No need to manually import here - Next.js handles it
}

