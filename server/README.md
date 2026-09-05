# King Legacy Stock Server

This lightweight Node.js server serves the dashboard and provides the demo community API.

## Run

Install Node.js 18 or newer, then run from the project root:

```powershell
npm start
```

Open `http://localhost:3000`. Reviews, users, and community data are stored in `server/data.json`. Access keys are read only from individual JSON files in `server/keys/`.

When an admin creates a key, the server automatically creates a new file in `server/keys/`. The key list in `data.json` is ignored and is removed the next time the server writes non-key data.

Keep `server/keys/` private. Do not commit real key files to a public repository.

The first admin key must be present as a JSON file in `server/keys/`. Admin-created keys are also written to that folder automatically.

## API

- `GET /api/reviews` returns saved reviews.
- `POST /api/reviews` saves a review with `rating` from 1 to 5 and `text` up to 240 characters.
- `POST /api/presence` updates the current browser heartbeat.
- `GET /api/community` returns the current online and total user counts.