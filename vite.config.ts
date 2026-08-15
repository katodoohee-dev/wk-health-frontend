import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Self-hosted target (Render/Node) instead of Lovable's default Cloudflare preset
  nitro: {
    preset: "node-server",
  },
});
