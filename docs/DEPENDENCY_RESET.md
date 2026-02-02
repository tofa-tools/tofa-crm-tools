# Clean dependency reset (monorepo)

Run from the **repo root** (`d:\tofa`) to remove all `node_modules` and `package-lock.json`, then reinstall so `@tofa/core` and other workspace packages are linked correctly.

## Windows (PowerShell) – single command

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue; Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue; Get-ChildItem -Path apps, packages -Recurse -Directory -Filter node_modules | ForEach-Object { Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue }; Get-ChildItem -Path apps, packages -Recurse -Filter package-lock.json | ForEach-Object { Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue }; npm install
```

What it does:

1. Deletes root `node_modules` and root `package-lock.json`.
2. Deletes every `node_modules` under `apps` and `packages`.
3. Deletes every `package-lock.json` under `apps` and `packages`.
4. Runs `npm install` at the root (reinstalls and links workspaces, including `@tofa/core`).

## After reset

Build the shared package so the mobile app can resolve `@tofa/core`:

```powershell
npm run build
```

Then run the mobile app:

- `npm run mobile:start` — start Metro
- `npm run android` or `npm run mobile:android` — run on Android
- `npm run ios` or `npm run mobile:ios` — run on iOS (macOS; run `pod install` in `apps/mobile/ios` first if needed)
