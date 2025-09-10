# H-One — Agile Plan (Current Status)

Methodology
- Approach: Agile (Kanban-style using GitHub Projects)
- Cadence: 2-week cycles, shippable increments
- Goal: Deliver a strong free MVP, polish iteratively

---

Cycle 1 — Foundation (Week 1)

Infra & Skeleton
- [x] Initialize repo (TypeScript, Tailwind, tooling)
- [x] SvelteKit app scaffold
- [x] Supabase schema (SQL) + link-token table (no expiry, owner can rotate)
- [x] Environment templates (.env.example)
- [ ] RLS tightened for production (owner policies in place; link flow via server)

Auth & Access
- [x] Public polls by link (token-based, no login to respond)
- [ ] Magic link login (owner auth) [Later]

Routing
- [x] / (landing)
- [x] /new (poll creation form with dropdowns)
- [x] /p/:pollId (poll page)
- [x] /p/:pollId/heatmap (placeholder)

Realtime
- [~] Supabase Realtime stub wired on client (payload logs); publication setup pending in DB

Core UI
- [x] TimelineHorizon placeholder
- [ ] Availability CRUD (drag to add/resize/delete)
- [ ] Live overlap glow
- [ ] Time zone auto-detect + manual override per participant (UI pass on poll page partially done for join; full per-user control later)

DevOps & Observability
- [x] PostHog wired (pageviews + poll_created)
- [x] Sentry wired (client/server)
- [ ] GitHub Actions CI (typecheck + build)

---

Cycle 2 — Suggestions & Sharing (Week 2)

Algorithm
- [ ] Edge Function: sweep time windows, compute scores (wAll=1.0, wMost=0.6, wPain=0.35, wSpread=0.15; top 5)
- [ ] Quiet hours per participant (22:00–07:00 local default; editable)
- [ ] Fairness mode toggle behavior
- [ ] Suggestions panel (ranked slots with rationale)

Collaboration
- [x] Share-by-link (token)
- [ ] Email invites via functions
- [ ] ICS export (selected slot)

Alternate View
- [ ] Heatmap View (compute intensity from availability data)
- [ ] Accessibility pass (labels/keyboard/contrast)

Polish
- [ ] Empty states & skeleton loaders
- [ ] Mobile gestures (drag, swipe, pinch zoom timeline)

---

Cycle 3 — Enhancements (Week 3+)

Integrations
- [ ] Google/Outlook Calendar (read busy times)
- [ ] Calendar sync (auto-book when consensus reached)

Branding / Pro Features
- [ ] Branded poll pages (logo, subdomain)
- [ ] Recurring meetings + rotation scheduling
- [ ] Analytics dashboard (team insights)

---

Current Feature Status Snapshot
- Create Poll: DONE (POST /api/polls)
- Poll Snapshot (by token): DONE (GET /api/polls/:id?t=)
- Join Poll (participant): DONE (POST /api/polls/:id/participants?t=)
- Poll Page Load: DONE (loads by token, join form + localStorage)
- Availability CRUD: PENDING
- Suggestions Engine: PENDING
- Heatmap: PENDING
- ICS Export: PENDING
- Email Invites: PENDING
- CI: PENDING

---

Next Focus (suggested)
1) Availability CRUD endpoints + UI wiring in TimelineHorizon
2) Suggestions edge function + minimal Suggestions panel
3) CI workflow (typecheck/build) and basic a11y fixes

