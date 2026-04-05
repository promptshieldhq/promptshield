import { InferPageType, loader } from 'fumadocs-core/source';
import { docs } from 'collections/server';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { statusBadgesPlugin } from 'fumadocs-core/source/status-badges';
import { docsContentRoute, docsImageRoute, docsRoute, siteUrl } from './shared';

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  plugins: [
    lucideIconsPlugin(),
    statusBadgesPlugin({
      renderBadge: (status) => (
        <span
          data-status={status}
          style={{
            marginLeft: '0.4rem',
            fontSize: '0.6rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '1px 6px',
            borderRadius: '9999px',
            border: '1px solid currentColor',
            opacity: 0.6,
            verticalAlign: 'middle',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'coming-soon' ? 'soon' : status}
        </span>
      ),
    }),
  ],
});

export function getPageImageUrl(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png'];
  return {
    segments,
    url: `${siteUrl}${docsImageRoute}/${segments.join('/')}`,
  };
}

export function getPageMarkdownUrl(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: `${docsContentRoute}/${segments.join('/')}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${page.url})

${processed}`;
}
