#!/bin/bash
# Clean Development Environment Script for macOS/Linux
# This script removes all build caches and node_modules to ensure a fresh start

echo "🧹 Cleaning Next.js and Turborepo build caches..."

# Remove Next.js build cache
if [ -d ".next" ]; then
    rm -rf .next
    echo "✅ Removed .next directory"
fi

# Remove Turborepo cache
if [ -d ".turbo" ]; then
    rm -rf .turbo
    echo "✅ Removed .turbo directory"
fi

# Remove node_modules cache
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo "✅ Removed node_modules/.cache"
fi

# Remove root-level caches
if [ -d "../../.turbo" ]; then
    rm -rf ../../.turbo
    echo "✅ Removed root .turbo directory"
fi

echo ""
echo "✨ Cleanup complete! You can now run 'npm run dev' for a fresh start."

