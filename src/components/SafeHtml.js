import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

/**
 * SafeHtml — render a Quill-produced HTML string in a read-only block.
 *
 * The rich-text editor (RichTextField, Quill 2) stores content as HTML
 * in TEXT columns. Readers need to render it back without exposing XSS
 * surface, and without dumping raw `<p><strong>…</strong></p>` into the
 * UI (which was the state before this component existed).
 *
 * Scope of sanitisation here is deliberately narrow — Quill emits a
 * small, well-known tag/attribute set. We allowlist that set, strip
 * everything else, and remove inline event handlers and `javascript:`
 * links. Server-side sanitisation (Jsoup, planned Batch R.4) is the
 * real defence in depth; this is the display-side guard.
 *
 * Props:
 *   html     — the stored HTML string (nullable).
 *   plain    — if true, strip ALL tags and render as plain text. Used
 *              in dense table cells (audit trail) where any wrapping
 *              <p> would break layout.
 *   emptyAs  — rendered when `html` is empty / only whitespace / only
 *              Quill's empty-editor marker (<p><br></p>). Defaults to
 *              a muted em-dash.
 *   maxLines — if set, clamps the rendered block with CSS line-clamp.
 *   sx       — passed to the wrapper Box.
 *
 * Only Quill's known tags are allowed. Anything else becomes text.
 */

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUB', 'SUP',
  'OL', 'UL', 'LI',
  'H1', 'H2', 'H3',
  'BLOCKQUOTE', 'PRE', 'CODE',
  'A', 'IMG',
  'SPAN', 'DIV',
]);

// Attributes we keep per tag. Everything else is dropped silently.
// style is kept but filtered to colour / background-color / text-align
// / font-size since Quill emits those for toolbar colour and alignment.
const ALLOWED_ATTRS = {
  'A':    ['href', 'target', 'rel'],
  'IMG':  ['src', 'alt', 'width', 'height'],
  'SPAN': ['class', 'style'],
  'DIV':  ['class', 'style'],
  'P':    ['class', 'style'],
  'LI':   ['class', 'style'],
  'OL':   ['class'],
  'UL':   ['class'],
};

const SAFE_STYLE_PROPS = new Set([
  'color', 'background-color', 'text-align',
  'font-size', 'font-weight', 'font-style',
]);

const sanitize = (html) => {
  if (!html) return '';
  if (typeof window === 'undefined' || !window.DOMParser) return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName;
        if (!ALLOWED_TAGS.has(tag)) {
          // Unwrap unknown element — keep its text content, drop the wrapper.
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          continue;
        }
        const allowed = ALLOWED_ATTRS[tag] || [];
        for (const attr of Array.from(child.attributes)) {
          if (!allowed.includes(attr.name)) {
            child.removeAttribute(attr.name);
            continue;
          }
          const v = attr.value || '';
          // Block javascript:, data: (except image inline), vbscript:
          if (attr.name === 'href' && /^\s*(javascript|vbscript|data):/i.test(v)) {
            child.removeAttribute(attr.name);
            continue;
          }
          if (attr.name === 'src' && tag === 'IMG') {
            if (!/^(https?:|data:image\/|\/)/i.test(v)) child.removeAttribute(attr.name);
            continue;
          }
          if (attr.name === 'style') {
            // Rebuild style, keeping only safe properties.
            const kept = v.split(';')
              .map((d) => d.split(':').map((s) => s.trim()))
              .filter(([k, val]) => k && val && SAFE_STYLE_PROPS.has(k.toLowerCase()))
              .map(([k, val]) => `${k}: ${val}`)
              .join('; ');
            if (kept) child.setAttribute('style', kept);
            else      child.removeAttribute('style');
            continue;
          }
          if (attr.name === 'target') {
            // Force rel=noopener on target=_blank
            if (v === '_blank') child.setAttribute('rel', 'noopener noreferrer');
          }
        }
        walk(child);
      } else if (child.nodeType === Node.ELEMENT_NODE &&
                 /^on/i.test(child.nodeName)) {
        // defensive — on* attributes should already be stripped above
        node.removeChild(child);
      }
    }
  };
  walk(root);
  return root.innerHTML;
};

// Quill's "empty editor" is "<p><br></p>" — treat as empty.
const isEffectivelyEmpty = (html) => {
  if (!html) return true;
  const t = String(html).replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .trim();
  return t.length === 0;
};

const SafeHtml = ({ html, plain = false, emptyAs, maxLines, sx }) => {
  const empty = isEffectivelyEmpty(html);

  const content = useMemo(() => {
    if (empty) return null;
    if (plain) {
      // Strip all tags, collapse whitespace.
      return String(html)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/p>\s*<p[^>]*>/gi, ' · ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return sanitize(html);
  }, [html, plain, empty]);

  if (empty) {
    return (
      <Typography variant="body2" color="text.disabled" sx={sx}>
        {emptyAs ?? '—'}
      </Typography>
    );
  }

  if (plain) {
    return (
      <Typography
        variant="body2"
        sx={{
          ...(maxLines ? {
            display: '-webkit-box',
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } : {}),
          ...sx,
        }}
      >
        {content}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        '& p': { m: 0, mb: 0.5 },
        '& p:last-child': { mb: 0 },
        '& ol, & ul': { pl: 3, m: 0, mb: 0.5 },
        '& h1, & h2, & h3': { m: 0, mb: 0.5, fontWeight: 700 },
        '& img': { maxWidth: '100%', height: 'auto' },
        '& a': { color: 'primary.main' },
        wordBreak: 'break-word',
        ...(maxLines ? {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } : {}),
        ...sx,
      }}
      // Content is sanitised above through DOMParser + allowlist walk.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default SafeHtml;
