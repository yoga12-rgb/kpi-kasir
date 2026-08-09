import { afterEach, describe, expect, it } from 'vitest';
import { getCronContext } from '../auth';

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe('cron auth', () => {
  it('requires a configured secret in the header', () => {
    process.env.CRON_SECRET = 'cron-secret';

    expect(
      getCronContext(new Request('http://localhost/api/cron/notifications?secret=cron-secret'))
        .authorized
    ).toBe(false);
    expect(
      getCronContext(
        new Request('http://localhost/api/cron/notifications', {
          headers: { 'x-cron-secret': 'cron-secret', 'x-invocation-id': 'test-invocation' },
        })
      )
    ).toEqual({ authorized: true, invocationId: 'test-invocation' });
  });

  it('rejects empty configured or supplied secrets', () => {
    process.env.CRON_SECRET = '';
    expect(getCronContext(new Request('http://localhost/api/cron/periods')).authorized).toBe(false);

    process.env.CRON_SECRET = 'cron-secret';
    expect(
      getCronContext(
        new Request('http://localhost/api/cron/periods', { headers: { 'x-cron-secret': ' ' } })
      ).authorized
    ).toBe(false);
  });
});
