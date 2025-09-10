import '@js-temporal/polyfill';
import * as Sentry from '@sentry/sveltekit';

const clientDsn = (import.meta.env.VITE_SENTRY_DSN as string) || undefined;
if (clientDsn) {
  Sentry.init({ dsn: clientDsn, tracesSampleRate: 0.1 });
}

export const handleError = Sentry.handleErrorWithSentry();

