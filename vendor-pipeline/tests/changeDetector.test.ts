import { cleanAndNormalizeHtml } from '../src/scripts/changeDetector';

describe('Change Detector html parser', () => {
  test('strips HTML boilerplate tags and collapses whitespace', () => {
    const rawHtml = `
      <html>
        <header>Navigation</header>
        <script>console.log('cookie');</script>
        <body>
          <div id="content">
            <h1>Legal Terms</h1>
            <p>Our DPA commits to 72 hours notification window.</p>
          </div>
        </body>
        <footer>Footer information © 2026</footer>
      </html>
    `;

    const cleaned = cleanAndNormalizeHtml(rawHtml);
    expect(cleaned).toContain('Legal Terms');
    expect(cleaned).toContain('Our DPA commits to 72 hours notification window.');
    expect(cleaned).not.toContain('Navigation');
    expect(cleaned).not.toContain('Footer information');
    expect(cleaned).not.toContain('console.log');
  });
});
