import React from 'react';

/**
 * Minimal markdown renderer for Copilot answers.
 *
 * The Copilot's own prompt tells the model to emit headings, bold text and
 * `[title](url)` citation links, and the router rewrites `[Source 1: …]` markers
 * into markdown links before returning. The page then rendered all of it as
 * plain text in a `whitespace-pre-wrap` div, so every answer arrived full of
 * literal `**` and `[EDPB Guidelines 05/2020](https://…)`.
 *
 * This covers exactly that subset rather than pulling in a parser: headings,
 * lists, rules, bold/italic, inline code and links. Everything is built as React
 * elements — no `dangerouslySetInnerHTML` anywhere — so untrusted model output
 * cannot inject markup.
 */

/** Links are model-authored, so anything but http(s) is rendered as plain text. */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://example.invalid');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const INLINE = /(\[[^\]]*\]\([^)]*\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((token, i) => {
    const key = `${keyPrefix}-${i}`;

    const link = token.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
    if (link) {
      const [, label, url] = link;
      const href = safeHref(url.trim());
      if (!href) return <span key={key}>{label}</span>;
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#C9A227] underline decoration-[#C9A227]/40 underline-offset-2 hover:decoration-[#C9A227]"
        >
          {label}
        </a>
      );
    }

    if (/^\*\*[^*]+\*\*$/.test(token)) {
      return (
        <strong key={key} className="font-semibold text-[#F4F5F6]">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (/^`[^`]+`$/.test(token)) {
      return (
        <code key={key} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em] text-[#E6E8EA]">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (/^\*[^*\n]+\*$/.test(token)) {
      return (
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    return <span key={key}>{token}</span>;
  });
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join('\n');
    paragraph = [];
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2 whitespace-pre-wrap first:mt-0 last:mb-0">
        {renderInline(text, `p-${blocks.length}`)}
      </p>,
    );
  };

  const flushAll = () => {
    flushList();
    flushParagraph();
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const size = level <= 2 ? 'text-base' : 'text-[14px]';
      blocks.push(
        <p key={`h-${blocks.length}`} className={`mt-4 mb-1.5 font-semibold text-[#F4F5F6] first:mt-0 ${size}`}>
          {renderInline(heading[2], `h-${blocks.length}`)}
        </p>,
      );
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushAll();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-3 border-white/10" />);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    flushList();
    paragraph.push(line);
  }
  flushAll();

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
