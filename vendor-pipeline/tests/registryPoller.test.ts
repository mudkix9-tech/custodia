import { pollDpfRegistry } from '../src/scripts/registryPoller';

describe('Registry Poller', () => {
  test('returns isDpfCertified true for known active participants', async () => {
    const status = await pollDpfRegistry('HubSpot');
    expect(status.isDpfCertified).toBe(true);
    expect(status.status).toBe('active');
  });

  test('returns isDpfCertified false for unknown participants', async () => {
    const status = await pollDpfRegistry('Unknown Analytics LLC');
    expect(status.isDpfCertified).toBe(false);
    expect(status.status).toBe('not_found');
  });
});
