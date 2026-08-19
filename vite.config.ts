import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Vite 8 has built-in tsconfig path support, but it is opt-in.
  // This is required by the existing @/* imports throughout the app.
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({ srcDirectory: "src" }),
    nitro({ preset: "node-server" }),
    // TanStack Start requires the React plugin after the Start plugin.
    react(),
  ],
});
