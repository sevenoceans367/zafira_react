# Deploy / pull on live (`zafira_react`)

Steps to update the live server after pushing changes.

## Commands

```bash
# 1. Go to the app repo
cd /home/seven-ocean-developer/zafira/zafira_react
# short form from home: cd zafira/zafira_react

# 2. Pull latest code
git pull

# 3. Build frontend
cd frontend
npm run build

# 4. Copy build output into the served app root
cp -r /home/seven-ocean-developer/zafira/zafira_react/frontend/dist/* /home/seven-ocean-developer/zafira/zafira_react/

# 5. Back to repo root and restart PM2
cd ..
pm2 restart 0
```

## Notes

- Prefer `pm2 restart 0` when the process is already running (`pm2 start 0` only if it is stopped).
- Confirm the process id with `pm2 list` if `0` is not the API/app.
- After `git pull`, run `npm install` in `frontend` (and `backend` if needed) when dependencies changed.
- The `cp` copies the Vite `dist` build into the repo root so the live app serves the new frontend.
