# King Legacy Stock Server

This lightweight Node.js server serves the dashboard and API. It supports local JSON fallback and optional Supabase persistence; GitHub OAuth is available for the configured administrator account.

## Run

Install Node.js 18 or newer, copy `.env.example` to `.env`, configure the credentials described below, then run from the project root:

```powershell
npm start
```

Open `http://localhost:3000`. Without Supabase credentials the existing local JSON/key-file mode remains active. With Supabase configured, keys, users, reviews, presence totals, and each account's application state use Supabase; never expose the service-role key to browser code.

To preview the app locally without reading or changing the configured Supabase project, set `SUPABASE_DISABLED=true` before starting the server. The app will use local JSON/key-file mode for that run.

## Supabase Free setup

1. Create a Supabase Free project and run `supabase/schema.sql` in its SQL Editor.
2. Copy the project URL and service-role key into `.env` as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses RLS, so it must remain server-side and `.env` must never be committed.
3. To import current local keys and users, run `npm run migrate:supabase` from the project root after setting the environment values. The migration uses upsert and can be repeated.

## GitHub administrator login

1. Create a GitHub OAuth App. Set its callback URL to `http://localhost:3000/api/auth/github/callback` for local development.
2. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_ADMIN_USERNAME`, and a long random `GITHUB_OAUTH_STATE_SECRET` in `.env`. OAuth is restricted to the configured GitHub username; all other accounts are rejected.
3. Restart the server. The GitHub administrator button appears on the access-key screen when OAuth settings are present.

For a public deployment, set `APP_ORIGIN` to the HTTPS site origin and register that exact callback URL in GitHub. This local Node server is for development; a public deployment also needs a host that supports the Node API, secure environment variables, and HTTPS.

## Optional Google/Discord identity verification

Access keys remain required to enter the app. After logging in with a key, users may optionally verify a Google or Discord account in Settings and attach its display name to that key. This is identity verification, not an alternative login method. When Supabase is enabled, the provider ID, display name, and email are saved in `public.user_identities`; the linked name appears in Admin and can be unlinked from Settings. Apply `supabase/schema.sql` to create this table if it does not exist yet.

Create a Google OAuth Web application and/or a Discord application with OAuth2 enabled. Register these local redirect URLs:

- Google: `http://localhost:3000/api/auth/google/callback`
- Discord: `http://localhost:3000/api/auth/discord/callback`

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, and `DISCORD_CLIENT_SECRET` in `.env`. Also configure `GITHUB_OAUTH_STATE_SECRET` with at least 32 characters; the verification buttons stay hidden until the provider credentials and state-signing secret are all configured. For a public deployment, register `<RENDER_EXTERNAL_URL>/api/auth/google/callback` and `<RENDER_EXTERNAL_URL>/api/auth/discord/callback` with the providers, then add the same credentials to Render's environment variables and redeploy. Never put provider secrets in browser code or chat.

The Google OAuth client and Discord OAuth application are configured for both `http://localhost:3000` and the Render site origin, with matching callback URLs. The Google consent screen is currently in Testing mode, so only accounts listed as test users can verify; add testers in Google Auth Platform → Audience, or complete any remaining verification requirements and publish the app before allowing general users. The public homepage and `/privacy.html` must be reachable before publishing. Do not use a localhost callback for a public deployment.

## Timed access-key policy

The Admin key list provides `+1 hour` and `-1 hour` controls for non-permanent keys, including keys that have expired. Expired keys can be extended only during the seven days after their expiration. At seven days they are removed from active keys and retained in the key archive for historical reference; archived keys cannot be used or extended.

## Deploy to Render Free

This repository includes `render.yaml` for a Render Free Node web service. Connect the repository in Render Blueprint, enter the requested secret/config values, and deploy. Render provides `RENDER_EXTERNAL_URL`; when `APP_ORIGIN` is not explicitly set the server uses this HTTPS URL to build OAuth callback URLs. Set the GitHub, Google, and Discord callback URLs to `<RENDER_EXTERNAL_URL>/api/auth/<provider>/callback` for the providers you configure.

Before connecting a repository to a public deployment, make sure access-key and local data files are not tracked or present in public Git history. `.gitignore` does not remove files that were already committed. Rotate any access keys that were committed before deployment.

In local fallback mode, when an admin creates a key the server creates a file in `server/keys/`; user/review data is stored in `server/data.json`. These files are not used as the source of truth when Supabase is configured.

Keep `server/keys/` private. Do not commit real key files to a public repository.
The web server blocks `.env` files, local user data, and access-key files from static HTTP access.

In local fallback mode, the first admin key must be present as a JSON file in `server/keys/`. When moving to Supabase, import these files once with the migration command above.

## API

- `GET /api/reviews` returns saved reviews.
- `POST /api/reviews` saves a review with `rating` from 1 to 5 and `text` up to 240 characters.
- `POST /api/presence` updates the current browser heartbeat.
- `GET /api/community` returns the current online and total user counts.