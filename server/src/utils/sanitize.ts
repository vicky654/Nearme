import sanitizeHtml from 'sanitize-html';

// sanitize-html always HTML-entity-encodes the text it emits (its job is to
// produce safe-to-inject-into-HTML markup). We use it here purely as a
// tag-stripping filter for plain-text fields (displayName, bio) that React
// will already escape correctly at render time, so its entity-encoded output
// must be decoded back to literal characters or users see "Tom &amp; Jerry"
// instead of "Tom & Jerry". sanitize-html has no option to disable this
// encoding (checked: no `textFilter`/`decodeEntities`-style output switch), so
// we decode the handful of named entities it can actually produce for text
// content (&amp; &lt; &gt;) plus &quot;/&#39;/&apos; defensively.
const HTML_ENTITY_DECODE_MAP: ReadonlyArray<readonly [string, string]> = [
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&apos;', "'"],
];

function decodeHtmlEntities(input: string): string {
  let decoded = input;
  for (const [entity, char] of HTML_ENTITY_DECODE_MAP) {
    decoded = decoded.split(entity).join(char);
  }
  // Decode &amp; last so a literal "&amp;lt;" (i.e. the user actually typed the
  // four characters &, l, t, ; ) round-trips to "&lt;", not "<".
  return decoded.split('&amp;').join('&');
}

export function sanitizeText(input: string): string {
  const sanitized = sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).trim();
  return decodeHtmlEntities(sanitized);
}
