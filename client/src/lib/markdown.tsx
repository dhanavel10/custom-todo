import type { ReactNode } from 'react';

/**
 * Tiny, dependency-free Markdown renderer for the Idea Pad preview.
 * Builds React elements directly (no innerHTML), so user content can never inject markup.
 * Supports: headings, bold, italic, inline code, fenced code, links (http/https/mailto),
 * bullet / numbered / task lists, blockquotes and horizontal rules.
 */

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith('`')) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('**') || tok.startsWith('__')) out.push(<strong key={k}>{renderInline(tok.slice(2, -2), k)}</strong>);
    else if (tok.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      const href = lm?.[2] ?? '';
      if (lm && /^(https?:|mailto:)/i.test(href)) {
        out.push(
          <a key={k} href={href} target="_blank" rel="noopener noreferrer">
            {lm[1]}
          </a>
        );
      } else out.push(tok);
    } else out.push(<em key={k}>{renderInline(tok.slice(1, -1), k)}</em>);
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMarkdown(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++}>
          <code>{code.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2], `h${key}`);
      blocks.push(level === 1 ? <h1 key={key++}>{content}</h1> : level === 2 ? <h2 key={key++}>{content}</h2> : <h3 key={key++}>{content}</h3>);
      i++;
      continue;
    }

    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key++}>{renderInline(quote.join(' '), `q${key}`)}</blockquote>);
      continue;
    }

    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: ReactNode[] = [];
      let n = 0;
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
        const task = /^\[( |x|X)\]\s*(.*)$/.exec(raw);
        if (task) {
          const done = task[1].toLowerCase() === 'x';
          items.push(
            <li key={n++} className={`md-task ${done ? 'is-done' : ''}`}>
              <span className="md-box" aria-hidden="true" />
              <span>{renderInline(task[2], `t${key}-${n}`)}</span>
            </li>
          );
        } else items.push(<li key={n++}>{renderInline(raw, `l${key}-${n}`)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key++}>{renderInline(para.join('\n'), `p${key}`)}</p>);
  }
  return blocks;
}

/** Plain-text preview for cards: strips markdown syntax. */
export function stripMarkdown(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+(\[( |x|X)\]\s*)?/gm, '• ')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_]/g, '$1$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}
