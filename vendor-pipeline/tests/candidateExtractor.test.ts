import { runCandidateExtractorOnText } from '../src/scripts/candidateExtractor';

describe('Candidate Extractor', () => {
  test('correctly extracts breach notification windows from text', () => {
    const text = 'The processor shall notify the controller within 72 hours of becoming aware of any personal data breach.';
    const suggestions = runCandidateExtractorOnText(text);

    expect(suggestions.length).toBeGreaterThan(0);
    const suggestion = suggestions[0];
    expect(suggestion.trigger).toBe('breach_notification');
    expect(suggestion.matchedText).toBe('72 hours');
    expect(suggestion.context).toContain('shall notify the controller within 72 hours');
  });

  test('correctly extracts subprocessor objection windows from text', () => {
    const text = 'Controller may object to any new sub-processor within 14 calendar days of receiving notice.';
    const suggestions = runCandidateExtractorOnText(text);

    expect(suggestions.length).toBeGreaterThan(0);
    const suggestion = suggestions.find(s => s.trigger === 'subprocessor_objection');
    expect(suggestion).toBeDefined();
    expect(suggestion!.matchedText).toBe('14 calendar days');
    expect(suggestion!.context).toContain('may object to any new sub-processor within 14 calendar days');
  });
});
