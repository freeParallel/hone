# TODO

Short-term
- [ ] Configure Supabase env (.env):
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY (server-only)
- [ ] Apply database schema in Supabase (see supabase/schema.sql)
- [ ] Enable Realtime publication for participants, availabilities, suggestions
- [ ] Implement GET /api/polls/[id] to validate token (?t=) and return poll details
- [ ] Update /p/[pollId] page to load data via the GET endpoint using token

MVP features
- [ ] TimelineHorizon: availability CRUD (drag/create/resize/delete)
- [ ] Suggestions: edge function scaffold + API trigger
- [ ] Heatmap view: compute intensity from availability data
- [ ] ICS export endpoint for selected slot

Polish
- [ ] A11y: ensure all labels are associated with controls on forms
- [ ] Add favicon and basic meta tags
- [ ] CI: GitHub Actions (typecheck, build)
- [ ] Error tracking (Sentry) and analytics (PostHog) wiring (env only for now)

Later
- [ ] Email invites via functions
- [ ] Quiet hours UI per participant
- [ ] Fairness mode: rotate inconvenient times across meetings
- [ ] Domain setup on Vercel (h-one.app primary, h-one.xyz redirect)
