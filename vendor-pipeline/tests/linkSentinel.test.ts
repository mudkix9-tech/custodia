import { checkUrl } from '../src/scripts/linkSentinel';

describe('Link Sentinel', () => {
  test('correctly handles 200 OK links without soft-404 keywords', async () => {
    const res = await checkUrl('Google', 'https://policies.google.com/privacy');
    expect(res.status).toBe('ok');
    expect(res.code).toBe(200);
  });

  test('correctly handles 404 links', async () => {
    const res = await checkUrl('Failing', 'https://httpstat.us/404');
    expect(res.status).toBe('broken');
    expect(res.code).toBe(404);
  });
});
