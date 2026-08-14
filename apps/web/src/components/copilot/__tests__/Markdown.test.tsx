import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Markdown } from '../Markdown';

describe('Markdown', () => {
  test('renders bold rather than literal asterisks', () => {
    render(<Markdown content="Article 6 is the **lawful basis** article." />);
    expect(screen.getByText('lawful basis').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  test('renders a citation link with its label, not the markdown', () => {
    render(<Markdown content="See [EDPB Guidelines 05/2020](https://edpb.europa.eu/x) for detail." />);
    const link = screen.getByRole('link', { name: 'EDPB Guidelines 05/2020' });
    expect(link.getAttribute('href')).toBe('https://edpb.europa.eu/x');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  test('renders bullets as a list', () => {
    render(<Markdown content={'Requirements:\n- Purpose\n- Retention\n- Recipients'} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  test('renders the Copilot Insights heading as a heading, not a hash', () => {
    render(<Markdown content={'### Copilot Insights\n- **Confidence**: High'} />);
    expect(screen.getByText('Copilot Insights')).toBeTruthy();
    expect(screen.queryByText(/###/)).toBeNull();
  });

  test('drops a javascript: link to plain text', () => {
    // Links come from model output, so the protocol is not assumed to be safe.
    render(<Markdown content="[click me](javascript:alert(1))" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('click me')).toBeTruthy();
  });

  test('renders inline code', () => {
    render(<Markdown content="Set `lawfulBasis` on the record." />);
    expect(screen.getByText('lawfulBasis').tagName).toBe('CODE');
  });

  test('renders a horizontal rule', () => {
    const { container } = render(<Markdown content={'Answer text\n\n---\n\n### Copilot Insights'} />);
    expect(container.querySelector('hr')).toBeTruthy();
  });

  test('leaves plain prose intact', () => {
    render(<Markdown content="A DPIA is required for systematic monitoring." />);
    expect(screen.getByText('A DPIA is required for systematic monitoring.')).toBeTruthy();
  });
});
