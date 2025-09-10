import '@js-temporal/polyfill';
import * as Sentry from '@sentry/sveltekit';
import posthog from 'posthog-js';

const clientDsn = (import.meta.env.VITE_SENTRY_DSN as string) || undefined;
if (clientDsn && (import.meta as any).env?.PROD) {
  Sentry.init({ dsn: clientDsn, tracesSampleRate: 0.1 });
}

const phKey = (import.meta.env.VITE_POSTHOG_KEY as string) || undefined;
const phHost = (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://us.i.posthog.com';
const enablePhInDev = (import.meta as any).env?.VITE_POSTHOG_ENABLE_DEV === '1';
if (phKey && (((import.meta as any).env?.PROD) || enablePhInDev)) {
  // Disable PostHog's history hooks to avoid SvelteKit warning; we capture pageviews manually in +layout.svelte
  posthog.init(phKey, {
    api_host: phHost,
    autocapture: true,
    capture_pageview: false,
    capture_pageview_on_history_change: false
  });
}

export const handleError = Sentry.handleErrorWithSentry();

