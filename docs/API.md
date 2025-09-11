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
- Default poll window is today..+7 days (UTC). Kept in the DB for compatibility. The current client UI ignores start_date/end_date and uses a rolling week navigation with the grid as the source of truth.
- Times are stored in UTC and rendered in the user's local time on the client. The calendar includes a current-time indicator and an inner scrollable area (8h by default) to navigate 24 hours.

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

## POST /api/polls/:id/availability?t=<token>
Upsert availability blocks for a participant.

Request
```
{
  "participant_id": "<uuid>",
  "blocks": [
    { "start": "2025-09-10T14:00", "end": "2025-09-10T15:00" }
  ],
  "replace": true // optional; default true
}
```
- start/end accept ISO8601 strings. For CLI testing, prefer timezone-explicit values like `2025-09-10T14:00:00Z`.
- When replace = true: existing blocks for this participant and poll are removed, then new blocks inserted.
- When replace = false: new blocks are appended.

Response 201
```
{ "ok": true, "inserted": 1 }
```

Errors
- 400 Invalid input / Missing token
- 403 Invalid or inactive token, or participant not in poll
- 500 DB error

Examples
Append a block
```bash
curl -X POST "http://127.0.0.1:5173/api/polls/$POLL_ID/availability?t=$TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "participant_id":"'$PARTICIPANT_ID'",
    "blocks":[{"start":"2025-09-10T14:00:00Z","end":"2025-09-10T15:00:00Z"}],
    "replace":false
  }'
```
Replace all blocks
```bash
curl -X POST "http://127.0.0.1:5173/api/polls/$POLL_ID/availability?t=$TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "participant_id":"'$PARTICIPANT_ID'",
    "blocks":[{"start":"2025-09-11T09:00:00Z","end":"2025-09-11T10:30:00Z"}],
    "replace":true
  }'
```

---

## DELETE /api/polls/:id/availability/:availabilityId?t=<token>&pid=<participant_id>
Delete a single availability block that belongs to the given participant.

Rules
- Token must be valid and active for the poll.
- The availability row must belong to the same poll and the provided participant id.

Response
- 204 No Content on success

Errors
- 400 Missing params (token/pid)
- 403 Invalid token or unauthorized (row does not belong to participant/poll)
- 404 Availability not found
- 500 DB error

Example
```bash
curl -X DELETE "http://127.0.0.1:5173/api/polls/$POLL_ID/availability/$AVAILABILITY_ID?t=$TOKEN&pid=$PARTICIPANT_ID" -i
```

---

## Planned endpoints (next)
- POST /api/polls/:id/suggest — compute ranked suggestions (edge function)
- GET /api/polls/:id/suggestions — read last computed results
- GET /api/polls/:id/ics?start=...&end=... — export selected slot

---

## Security notes
- SUPABASE_SERVICE_ROLE_KEY is used server-side only inside SvelteKit endpoints (never exposed to client).
- Token validation is required on all unauthenticated operations (read/join).
- RLS policies default to owner manage; link-token provides controlled public access through server endpoints.

