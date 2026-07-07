# Zafira React

Monorepo with a React frontend (Zafira UI kit) and a Node.js backend API.

## Structure

```
frontend/   React + Vite app (Zafira UI components)
backend/    Node.js Express API (PHP integration later)
```

## Setup

```bash
npm run install:all
```

Or install each folder separately:

```bash
cd frontend && npm install
cd ../backend && npm install
```

## Run

From the project root, start both servers with one command:

```bash
npm run dev
```

- Backend: **http://localhost:3000**
- Frontend: **http://localhost:5173**

The frontend proxies `/api/*` requests to the backend.

To run them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Build frontend

```bash
npm run build
```
