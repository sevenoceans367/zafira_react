# Zafira

Portable React UI kit — sidebar, top header (breadcrumbs, recent activity, notifications), page title bar, buttons, confirm dialogs, loading overlay, theme, and optional card/table styles.

Copy the entire `zafira` folder into any Vite + React project.

## Quick start

### 1. Copy folder

```
your-project/
  src/
  zafira/          ← paste this folder here (or anywhere; adjust import paths)
```

### 2. Install dependencies

```bash
npm install flatpickr bootstrap bootstrap-icons
```

Peer deps (you likely already have these):

```bash
npm install react react-dom react-router-dom
```

### 3. Wire Vite alias (recommended)

`vite.config.js`:

```js
import path from 'path';

export default {
  resolve: {
    alias: {
      zafira: path.resolve(__dirname, 'zafira'),
    },
  },
};
```

### 4. Import global styles in `main.jsx`

```js
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'zafira/global.css';
import 'zafira/cards.css'; // optional
```

### 5. App base path (optional)

If the app is served under a sub-path (e.g. `/ops`), set in `.env`:

```
VITE_APP_BASE=/ops
```

Call once at startup:

```js
import { installLinkInterceptor, installBasePathGlobals } from 'zafira';

installBasePathGlobals();
installLinkInterceptor();
```

### 6. Layout example

See `example/AppLayout.jsx` for a minimal shell with sidebar + page header.

```jsx
import {
  AppShell,
  AppSidebar,
  BusinessPageHeader,
  ConfirmProvider,
  Button,
  appPath,
} from 'zafira';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Sidebar({ isOpen }) {
  return (
    <AppSidebar isOpen={isOpen}>
      <a href={appPath('/')} className="sidebar-link">Dashboard</a>
    </AppSidebar>
  );
}

function DashboardPage() {
  return (
    <>
      <BusinessPageHeader
        title="Dashboard"
        breadcrumbs={[{ label: 'Home', href: appPath('/') }]}
        currentPage="Dashboard"
      />
      <div className="zafira-page">
        <div className="zafira-card">
          <div className="zafira-card-body">
            <Button variant="primary">Save</Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ConfirmProvider>
      <BrowserRouter basename={import.meta.env.VITE_APP_BASE || undefined}>
        <AppShell
          companyName="Acme Corp"
          sidebar={({ isOpen }) => <Sidebar isOpen={isOpen} />}
          onSignOut={() => { /* your logout */ }}
        >
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </AppShell>
      </ConfirmProvider>
    </ConfirmProvider>
  );
}
```

## What's included

| Export | Purpose |
|--------|---------|
| `AppShell` | Sidebar + header + main content area |
| `AppHeader` | Top bar: menu toggle, breadcrumbs, recent activity drawer, notifications drawer, profile |
| `AppSidebar` | Collapsible sidebar shell (pass your nav links as children) |
| `BusinessPageHeader` | White page title bar; syncs breadcrumbs to `AppHeader` |
| `Button` / `GlobalButton` | Themed buttons |
| `LoadingOverlay` | Full-page loading spinner |
| `ConfirmProvider` / `useConfirm` | Confirm dialogs |
| `DmyDateInput` | DD/MM/YYYY date picker (flatpickr) |
| `StatusBadge` | Status chips with preset variants |
| `ScaffoldSidebar` | Helper for multi-level sidebar menus |
| `theme` | JS theme tokens (colors, font sizes) |
| `appPath`, `getAppRoute`, … | Routing helpers for sub-path deployments |

## Branding

Replace logos in `zafira/assets/` or pass props to `AppSidebar`:

```jsx
<AppSidebar
  isOpen={isOpen}
  brandLogo="/my-logo.svg"
  brandText="/my-wordmark.svg"
  brandLogoAlt="My Company"
/>
```

## Header APIs

`AppHeader` loads drawers from these endpoints (implement on your backend or mock in dev):

| Endpoint | Response shape |
|----------|------------------|
| `GET /api/recent_work` | `[{ work: string, datetime: string }]` |
| `GET /api/alerts` | `[{ alertId, title, message, datetime }]` |

To change URLs, edit `zafira/services/recentWork.js` and `zafira/services/userAlerts.js`.

## Page breadcrumbs

`BusinessPageHeader` dispatches `app-page-header-change` so breadcrumbs appear in `AppHeader` automatically. Pass `breadcrumbs`, `currentPage`, and optional `homeHref`.

## Sidebar styling

Use classes from `AppSidebar.css` in your nav:

- `sidebar-link` — normal item
- `sidebar-link active` — current page
- `sidebar-section` — group label
- `sidebar-flyout` — nested flyout menu (see existing dryout sidebar for patterns)

## No monorepo required

This package has **no** `@bainbridge/*` dependencies. Everything is self-contained except React, React Router, Bootstrap, and flatpickr.
