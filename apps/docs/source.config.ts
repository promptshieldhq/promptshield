import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import lastModified from 'fumadocs-mdx/plugins/last-modified';
import jsonSchema from 'fumadocs-mdx/plugins/json-schema';
import { pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({
      index: z.boolean().default(false),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
    async mdxOptions(environment) {
      const { rehypeCodeDefaultOptions } = await import('fumadocs-core/mdx-plugins/rehype-code');
      const { remarkSteps } = await import('fumadocs-core/mdx-plugins/remark-steps');

      return applyMdxPreset({
        rehypeCodeOptions: {
          inline: 'tailing-curly-colon',
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
          transformers: [...(rehypeCodeDefaultOptions.transformers ?? [])],
        },
        remarkCodeTabOptions: {
          parseMdx: true,
        },
        remarkNpmOptions: {
          persist: {
            id: 'package-manager',
          },
        },
        remarkPlugins: [remarkSteps],
      })(environment);
    },
  },
});

export default defineConfig({
  plugins: [
    jsonSchema({ insert: true }),
    lastModified(),
  ],
});
