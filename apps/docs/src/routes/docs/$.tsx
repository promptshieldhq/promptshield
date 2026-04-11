import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { createServerFn } from "@tanstack/react-start";
import { getPageImageUrl, getPageMarkdownUrl, source } from "@/lib/source";
import browserCollections from "collections/browser";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  PageLastUpdate,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { baseOptions } from "@/lib/layout.shared";
import { gitConfig } from "@/lib/shared";
import {
  useFumadocsLoader,
  type SerializedPageTree,
} from "fumadocs-core/source/client";
import { Suspense } from "react";
import { useMDXComponents } from "@/components/mdx";
import type { ReactNode } from "react";

type DocPageLoaderData = {
  path: string;
  title: string;
  description: string | null;
  imageUrl: string;
  markdownUrl: string;
  pageTree: SerializedPageTree;
};

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      path: page.path,
      title: page.data.title,
      description: page.data.description ?? null,
      imageUrl: getPageImageUrl(page).url,
      markdownUrl: getPageMarkdownUrl(page).url,
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });

export const Route = createFileRoute("/docs/$")({
  component: Page,
  head: ({ loaderData }) => {
    const data = loaderData as DocPageLoaderData | undefined;
    return {
      meta: data
        ? [
            {
              title: data.title
                ? `${data.title} — PromptShield`
                : "PromptShield Docs",
            },
            ...(data.description
              ? [{ name: "description", content: data.description }]
              : []),
            {
              property: "og:title",
              content: data.title ?? "PromptShield Docs",
            },
            ...(data.description
              ? [{ property: "og:description", content: data.description }]
              : []),
            { property: "og:image", content: data.imageUrl },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:type", content: "article" },
            { name: "twitter:card", content: "summary_large_image" },
            { name: "twitter:image", content: data.imageUrl },
          ]
        : [],
    };
  },
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});

type PageExports = {
  toc: Parameters<typeof DocsPage>[0]["toc"];
  frontmatter: {
    title: string;
    description?: string;
    full?: boolean;
    index?: boolean;
  };
  default: (props: {
    components: MDXProvidedComponents;
  }) => ReactNode | Promise<ReactNode>;
  lastModified?: Date;
};

const clientLoader = browserCollections.docs.createClientLoader({
  component(
    pageExports: PageExports,
    {
      markdownUrl,
      path,
    }: {
      markdownUrl: string;
      path: string;
    },
  ) {
    const { toc, frontmatter, default: MDX, lastModified } = pageExports;
    return (
      <DocsPage
        toc={toc}
        tableOfContent={{ style: "clerk" }}
        full={frontmatter.full}
      >
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <div className="flex flex-row gap-2 items-center border-b pb-6">
          <MarkdownCopyButton markdownUrl={markdownUrl} />
          <ViewOptionsPopover
            markdownUrl={markdownUrl}
            githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${path}`}
          />
        </div>
        <DocsBody>
          <MDX components={useMDXComponents()} />
        </DocsBody>
        {lastModified && <PageLastUpdate date={lastModified} />}
      </DocsPage>
    );
  },
});

function Page() {
  const { path, pageTree, markdownUrl } = useFumadocsLoader(
    Route.useLoaderData() as DocPageLoaderData,
  );

  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <Suspense>
        {clientLoader.useContent(path, { markdownUrl, path })}
      </Suspense>
    </DocsLayout>
  );
}
