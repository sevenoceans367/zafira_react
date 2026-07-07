# Zafira Backend

Node.js API server for the Zafira frontend.

## Setup

```bash
npm install
```

Copy env file and set your database credentials:

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
DB_HOST=zafira
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name
MODULE_ID=1
COMPANY_ID=1
```

Test connection: `GET http://localhost:3000/api/health`

If `database.connected` is `true`, the API reads from MySQL. Otherwise it falls back to mock data.

## Run

```bash
npm run dev    # development with auto-reload
npm start      # production
```

Server runs at **http://localhost:3000**.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/recent_work` | Recent activity for header drawer |
| GET | `/api/alerts` | Notifications for header drawer |

## PHP files

Place your PHP files in the `php/` folder when ready. They can be wired into routes here later.
