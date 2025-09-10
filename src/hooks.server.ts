import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/private';

const serverDsn = env.SENTRY_DSN;
if (serverDsn) {
  Sentry.init({ dsn: serverDsn, tracesSampleRate: 0.1 });
}

export const handleError = Sentry.handleErrorWithSentry();

