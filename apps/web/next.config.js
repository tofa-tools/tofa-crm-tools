/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    // Only enable instrumentation hook if Sentry is configured
    instrumentationHook: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  webpack: (config, { isServer }) => {
    // Ensure React resolves correctly in monorepo
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
}

// Only wrap with Sentry if DSN is configured AND Sentry is available
let finalConfig = nextConfig;

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    const { withSentryConfig } = require('@sentry/nextjs');
    finalConfig = withSentryConfig(nextConfig, {
      // For all available options, see:
      // https://github.com/getsentry/sentry-webpack-plugin#options

      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Only print logs for uploading source maps in CI
      silent: !process.env.CI,

      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
      // This can increase your server load as well as your hosting bill.
      // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
      // side errors will fail.
      tunnelRoute: '/monitoring',

      // Hides source maps from generated client bundles
      hideSourceMaps: true,
    }, {
      // Second argument: Sentry webpack plugin options
      // Enables automatic instrumentation of Vercel Cron Monitors
      // See: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
      automaticVercelMonitors: true,
      
      // Webpack config for tree-shaking debug logs
      webpack: {
        treeshake: {
          removeDebugLogging: true,
        },
      },
    });
  } catch (error) {
    // Sentry not available, skip it
    console.warn('Sentry not available, skipping Sentry configuration:', error.message);
  }
}

module.exports = finalConfig;


