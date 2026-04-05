import { createFileRoute } from '@tanstack/react-router';
import { source } from '@/lib/source';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { appName } from '@/lib/shared';

// Initialize WASM once per server process
let wasmInitialized = false;
async function ensureWasm() {
  if (wasmInitialized) return;
  await initWasm(
    fetch('https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm'),
  );
  wasmInitialized = true;
}

// Cache fonts at module level — loaded once per server process
let fontsCache: { name: string; data: ArrayBuffer; weight: 400 | 600 }[] | null = null;

async function getFonts() {
  if (fontsCache) return fontsCache;
  const [fontRegular, fontSemiBold] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff').then(
      (r) => r.arrayBuffer(),
    ),
    fetch('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.woff').then(
      (r) => r.arrayBuffer(),
    ),
  ]);
  fontsCache = [
    { name: 'Inter', data: fontRegular, weight: 400 },
    { name: 'Inter', data: fontSemiBold, weight: 600 },
  ];
  return fontsCache;
}

export const Route = createFileRoute('/og/docs/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const segments = params._splat?.split('/') ?? [];
          // Remove the trailing "image.png" segment to get page slugs
          const slugs = segments.slice(0, -1);
          const page = source.getPage(slugs);
          if (!page) return new Response('Not Found', { status: 404 });

          const { title, description } = page.data;
          const [fonts] = await Promise.all([getFonts(), ensureWasm()]);

          const svg = await satori(
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                backgroundColor: '#0a0f1e',
                backgroundImage: 'linear-gradient(to top right, rgba(37,99,235,0.35), transparent)',
                padding: '64px',
                fontFamily: 'Inter',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgb(37,99,235)',
                  }}
                />
                <p style={{ fontSize: '24px', fontWeight: 600, color: 'rgb(148,163,184)', margin: 0 }}>
                  {appName}
                </p>
              </div>

              <p
                style={{
                  fontSize: '64px',
                  fontWeight: 600,
                  color: 'white',
                  margin: '0 0 20px 0',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}
              >
                {title}
              </p>

              {description && (
                <p
                  style={{
                    fontSize: '28px',
                    fontWeight: 400,
                    color: 'rgb(148,163,184)',
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {description}
                </p>
              )}

              <div style={{ display: 'flex', marginTop: 'auto', fontSize: '20px', color: 'rgb(100,116,139)' }}>
                promptshield-docs.vercel.app
              </div>
            </div>,
            { width: 1200, height: 630, fonts },
          );

          const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
          const png = resvg.render().asPng();

          return new Response(png as unknown as BodyInit, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=86400, immutable',
            },
          });
        } catch (err) {
          console.error('[og] Error generating image:', err);
          return new Response('Internal Server Error', { status: 500 });
        }
      },
    },
  },
});
