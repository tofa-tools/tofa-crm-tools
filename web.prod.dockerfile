# 1. Builder Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Update npm to be sure we have the latest workspace fixes
RUN npm install -g npm@latest

# Copy ONLY the instructions for the parts we want to build
COPY package.json turbo.json ./
COPY packages/core/package.json ./packages/core/package.json
COPY apps/web/package.json ./apps/web/package.json

# --- THE FIX: NO LOCKFILE ---
# By not copying the package-lock.json, we force npm to only look at the 
# folders we actually provided (Web and Core). It will ignore the 'mobile' 
# folder entirely, which stops the 'Invalid Version' crash.
RUN npm install --legacy-peer-deps

# Now copy the actual source code for those two folders
COPY packages/core ./packages/core
COPY apps/web ./apps/web

# Build the app DIRECTLY inside the apps/web folder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Running the build inside the specific app folder
RUN cd apps/web && npm run build

# 2. Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone output moves everything we need into .next/standalone
# We copy it to the root of the runner
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]