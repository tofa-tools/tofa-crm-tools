// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Define workspace root (monorepo root - one level up from apps/mobile)
const workspaceRoot = path.resolve(__dirname, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Set project root to the mobile app directory
const projectRoot = __dirname;
config.projectRoot = projectRoot;

// Watch folders - include workspace root to detect changes in monorepo
config.watchFolders = [
  projectRoot, // Mobile app directory
  workspaceRoot, // Monorepo root (includes root node_modules)
];

// Configure resolver for monorepo workspace packages
config.resolver = {
  ...config.resolver,
  // Resolve node_modules from both project level and workspace level
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'), // Project level node_modules
    path.resolve(workspaceRoot, 'node_modules'), // Workspace level node_modules
  ],
  // Map workspace packages to their actual locations
  extraNodeModules: {
    '@tofa/core': path.resolve(workspaceRoot, 'packages/core'),
  },
};

// Configure transformer for SDK 50 - ensure environment variables are passed correctly
config.transformer = {
  ...config.transformer,
  // Get transform options to pass environment variables to the bundler
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Set EXPO_ROUTER_APP_ROOT environment variable for the bundler
// This ensures process.env.EXPO_ROUTER_APP_ROOT is resolved correctly
if (!process.env.EXPO_ROUTER_APP_ROOT) {
  process.env.EXPO_ROUTER_APP_ROOT = 'app';
}

module.exports = config;
