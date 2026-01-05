export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-server');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./instrumentation-edge');
  }
  
  // Client-side config is loaded automatically via instrumentation-client.ts
  // No need to manually import here - Next.js handles it
}

