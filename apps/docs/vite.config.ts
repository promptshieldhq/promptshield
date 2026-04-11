import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";

const nitroPreset = (process.env.NITRO_PRESET ??
  (process.env.VERCEL ? "vercel" : "node")) as "node" | "vercel";

export default defineConfig({
  server: {
    port: 4000,
  },
  plugins: [
    mdx(await import("./source.config")),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: nitroPreset !== "node",
      },
    }),
    react(),
    nitro({
      preset: nitroPreset,
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js",
    },
  },
});
