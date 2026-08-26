# Netlify auth fix

This project is a Next.js App Router app. Netlify's current Next.js adapter handles API route handlers automatically.

## Important
1. Do not set `NEXT_PRIVATE_TARGET=serverless`.
2. Do not add the legacy `@netlify/plugin-nextjs` plugin block for this Next.js version.
3. In Netlify, set `SESSION_SECRET` to a long random value (32+ characters).
4. After deploying, open `/api/health`. It must return JSON with `success: true` and `database: true`.
5. If `/api/health` is 500, open Netlify Functions logs and fix the database/runtime error before testing login.

## Database persistence warning
The current SQLite/sql.js implementation writes to the function filesystem. Netlify Functions are ephemeral, so this is not a production-persistent database. Login may work but accounts/data can disappear between cold starts. For production, move the database layer to a persistent serverless datastore (for example Netlify Blobs or a hosted SQL database).
