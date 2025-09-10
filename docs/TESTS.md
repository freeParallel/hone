# API E2E tests

We use Playwright Test to exercise the SvelteKit endpoints end‑to‑end.

Prereqs
- Supabase project configured and .env filled (same as the app)
- Optional (cleanup): set SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in the environment running the tests

Install
- pnpm install
- (No browsers required for API tests)

Run
- Dev server already running (recommended):
  - pnpm run dev (or keep it running in another tab)
  - pnpm run test:e2e
- Or let Playwright start preview automatically:
  - pnpm run build
  - pnpm run test:e2e

What the tests cover
- Create poll → snapshot → join participant → add availability → delete availability
- Optional cleanup via Supabase service role key (if provided in env)

Notes
- Tests run against http://127.0.0.1:5173 by default (see playwright.config.ts). You can override with BASE_URL env.
- The tests create real rows; if you don’t provide the service role key, the test data will remain in your Supabase project.
- For CI later, add a GitHub Action job that runs build + test:e2e and sets the Supabase env vars in repository secrets.

