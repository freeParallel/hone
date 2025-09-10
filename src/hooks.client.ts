import '@js-temporal/polyfill';
import * as Sentry from '@sentry/sveltekit';
import posthog from 'posthog-js';

const clientDsn = (import.meta.env.VITE_SENTRY_DSN as string) || undefined;
if (clientDsn) {
  Sentry.init({ dsn: clientDsn, tracesSampleRate: 0.1 });
}

const phKey = (import.meta.env.VITE_POSTHOG_KEY as string) || undefined;
const phHost = (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://us.i.posthog.com';
if (phKey) {
  // disable automatic pageview; we'll capture in +layout.svelte on route changes
  posthog.init(phKey, { api_host: phHost, autocapture: true, capture_pageview: false });
}

export const handleError = Sentry.handleErrorWithSentry();

