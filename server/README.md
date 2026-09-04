# King Legacy Stock Server

This lightweight Node.js server serves the dashboard and provides the demo community API.

## Run

Install Node.js 18 or newer, then run from the project root:

```powershell
npm start
```

Open `http://localhost:3000`. Data is stored in `server/data.json`.

Set `ADMIN_BOOTSTRAP_KEY` before starting the server to create the first admin access key. The admin key is used only to open the key-management screen; generated user keys are created there.

PowerShell example:

```powershell
$env:ADMIN_BOOTSTRAP_KEY = "IGH-ADMIN-CHANGE-ME"
npm start
```

## API

- `GET /api/reviews` returns saved reviews.
- `POST /api/reviews` saves a review with `rating` from 1 to 5 and `text` up to 240 characters.
- `POST /api/presence` updates the current browser heartbeat.
- `GET /api/community` returns the current online and total user counts.