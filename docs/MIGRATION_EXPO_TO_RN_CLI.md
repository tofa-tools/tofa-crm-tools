# Replace Expo Mobile App with React Native CLI (TOFAMobile)

**The hard replacement has been performed:** the old Expo app was deleted, `TOFAMobile` was renamed to `apps/mobile`, and root scripts were updated. This doc describes what was done and how to run the new app.

## What Was Done

1. **Initialized** a new React Native CLI project with TypeScript:
   - `npx @react-native-community/cli@latest init TOFAMobile` was run inside `apps/`, creating `apps/TOFAMobile`.

2. **Monorepo / @tofa/core**
   - `metro.config.js` in TOFAMobile watches the monorepo root and resolves `@tofa/core` to `packages/core`.
   - `package.json` adds `"@tofa/core": "*"` and a `postinstall` script that runs `npm install` from the repo root so workspace packages are linked.

3. **Navigation**
   - Installed: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`, `@react-navigation/drawer`, `react-native-screens`, `react-native-gesture-handler`.
   - **Bottom tabs**: Home (Command Center), Leads, Tasks, More.
   - **More** screen lists admin tasks (Batches, Centers, Users, Approvals, Import) and Logout — ready for role-based visibility later.

4. **Theme**
   - **Navy & Gold** theme in `src/theme/brandTheme.ts` (colors from `@tofa/core` brandConfig).
   - **StandardButton**: variants `primary`, `accent`, `outline` using brand colors.
   - **StandardText**: variants `title`, `body`, `caption`, `label` with optional color.

---

## After replacement: install and run

From **repo root** (`d:\tofa`):

1. **Clean install** (see `docs/DEPENDENCY_RESET.md` for the full command):
   ```powershell
   Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue; Get-ChildItem -Path apps, packages -Recurse -Directory -Filter node_modules | ForEach-Object { Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue }; npm install
   ```
2. **Build shared package** (required for `@tofa/core`):
   ```powershell
   npm run build
   ```
3. **Run the app** from root:
   - `npm run mobile:start` — start Metro
   - `npm run mobile:android` — run on Android
   - `npm run mobile:ios` — run on iOS (macOS; run `pod install` in `apps/mobile/ios` first if needed)

---

## Project layout (apps/mobile)

- `App.tsx` – Entry: SafeAreaProvider, NavigationContainer, RootNavigator.
- `src/theme/brandTheme.ts` – Navy & Gold colors and shared styles.
- `src/components/StandardButton.tsx`, `StandardText.tsx` – Branded UI.
- `src/navigation/RootNavigator.tsx` – Root stack (MainTabs for now; Login can be added).
- `src/navigation/MainTabs.tsx` – Bottom tabs: Home, Leads, Tasks, More.
- `src/screens/` – HomeScreen, LeadsScreen, TasksScreen, MoreScreen (placeholders).
- `metro.config.js` – Monorepo: watch root, resolve `@tofa/core`.

---

## Optional: Use a drawer for “More”

Right now “More” is a **tab that opens a list screen**. To make “More” open a **drawer** (slide-out menu) for admin tasks:

1. Wrap the main content in a Drawer navigator (`@react-navigation/drawer` is already in package.json).
2. Set the drawer content to a list of admin items (Batches, Centers, Users, Approvals, Import) and Logout.
3. Show/hide drawer items by role (e.g. team_lead sees all; coach sees none or a subset).

The current More **screen** can be reused as the drawer content component.
