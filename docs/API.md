# H-One API (MVP)

Base URL (dev)
- http://127.0.0.1:5173

Auth model (MVP)
- Public polls by link. Access is authorized using an opaque link token passed as a query param: `?t=<token>`.
- Owner can rotate the token to invalidate old links. No expiry by default.

Conventions
- Content-Type: application/json
- Times are UTC in storage. Client displays in local time.

Environment variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only)
- Optional: VITE_SENTRY_DSN, SENTRY_DSN, VITE_POSTHOG_KEY, VITE_POSTHOG_HOST

---

## POST /api/polls
Create a poll and an active link token.

Request
```
{
  "title": "Team sync",
  "durationMinutes": 60,            // 15..480
  "timezoneMode": "local",          // one of: local | organizer | utc
  "fairnessMode": false,
  "quietHours": { "start": 22, "end": 7 } // 0..23 (editable per participant later)
}
```

Response 201
```
{
  "id": "<poll_id>",
  "token": "<opaque_token>",
  "link": "/p/<poll_id>?t=<opaque_token>"
}
```

Errors
- 400 Invalid input
- 500 Server not configured / DB error

Example
```bash
curl -X POST http://127.0.0.1:5173/api/polls \
  -H 'Content-Type: application/json' \
  -d '{
    "title":"Team sync",
    "durationMinutes":60,
    "timezoneMode":"local",
    "fairnessMode":false,
    "quietHours":{"start":22,"end":7}
  }'
```

Notes
- Default poll window is today..+7 days (UTC). Can be extended later via UI.

---

## GET /api/polls/:id?t=<token>
Validate token and return a poll snapshot.

Response 200
```
{
  "poll": {
    "id": "...",
    "title": "...",
    "description": null,
    "duration_minutes": 60,
    "start_date": "2025-09-10",
    "end_date": "2025-09-17",
    "timezone_mode": "local",
    "fairness_mode": false,
    "created_at": "...",
    "updated_at": "..."
  },
  "participants": [
    { "id":"...", "name":"...", "email":null, "tz":"Europe/Paris", "quiet_start":22, "quiet_end":7, "invited_at":"...", "responded_at":null }
  ],
  "availabilities": [
    { "id":"...", "participant_id":"...", "start_ts":"2025-09-11T09:00:00Z", "end_ts":"2025-09-11T10:00:00Z" }
  ]
}
```

Errors
- 400 Missing poll id / token
- 403 Invalid or inactive token
- 404 Poll not found

Example
```bash
curl "http://127.0.0.1:5173/api/polls/<poll_id>?t=<token>"
```

---

## POST /api/polls/:id/participants?t=<token>
Create (join) a participant for the poll.

Request
```
{
  "name": "Alex",               // required
  "email": "alex@example.com",  // optional
  "tz": "Europe/Paris"         // IANA zone (auto-detected on client)
}
```

Response 201
```
{
  "participant": {
    "id": "...",
    "name": "Alex",
    "email": "alex@example.com",
    "tz": "Europe/Paris",
    "quiet_start": 22,
    "quiet_end": 7
  }
}
```

Errors
- 400 Invalid input / Missing token
- 403 Invalid or inactive token
- 500 DB error

Example
```bash
curl -X POST "http://127.0.0.1:5173/api/polls/<poll_id>/participants?t=<token>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alex","email":"","tz":"Europe/Paris"}'
```

---

## Planned endpoints (next)
- POST /api/polls/:id/availability — upsert availability blocks (requires participant id)
- POST /api/polls/:id/suggest — compute ranked suggestions (edge function)
- GET /api/polls/:id/suggestions — read last computed results
- GET /api/polls/:id/ics?start=...&end=... — export selected slot

---

## Security notes
- SUPABASE_SERVICE_ROLE_KEY is used server-side only inside SvelteKit endpoints (never exposed to client).
- Token validation is required on all unauthenticated operations (read/join).
- RLS policies default to owner manage; link-token provides controlled public access through server endpoints.

