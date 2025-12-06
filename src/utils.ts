import { HeadDescriptor } from '@dropinblog/react-core';

export function renderHeadTags(descriptors: HeadDescriptor[]): string {
  return descriptors
    .map((desc) => {
      if (desc.tag === 'title') {
        return `<title>${escapeHtml(desc.content || '')}</title>`;
      }

      const attrs = desc.attributes
        ? Object.entries(desc.attributes)
            .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
            .join(' ')
        : '';

      if (desc.tag === 'meta' || desc.tag === 'link') {
        return `<${desc.tag} ${attrs}>`;
      }

      if (desc.tag === 'script') {
        const content = desc.content || '';
        return `<script ${attrs}>${content}</script>`;
      }

      const content = desc.content || '';
      return content ? `<${desc.tag} ${attrs}>${content}</${desc.tag}>` : `<${desc.tag} ${attrs}>`;
    })
    .join('\n    ');
}

export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}

export interface HtmlTemplateOptions {
  title?: string;
  headTags?: string;
  content: string;
  bodyAttributes?: Record<string, string>;
  additionalHeadContent?: string;
  additionalBodyContent?: string;
}

export function renderHtmlTemplate(options: HtmlTemplateOptions): string {
  const {
    title = 'Blog',
    headTags = '',
    content,
    bodyAttributes = {},
    additionalHeadContent = '',
    additionalBodyContent = '',
  } = options;

  const bodyAttrs = Object.entries(bodyAttributes)
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(' ');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    ${headTags}${additionalHeadContent}
  </head>
  <body${bodyAttrs ? ' ' + bodyAttrs : ''}>
    ${content}${additionalBodyContent}
  </body>
</html>`;
}
