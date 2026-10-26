import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Đảm bảo CSS được nhúng đúng vào output
    cssCodeSplit: true,
    // Tăng giới hạn chunk warning (tránh log nhiễu không cần thiết)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Chia nhỏ vendor libs thành chunk riêng để cache lâu hơn
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-tooltip", "@radix-ui/react-accordion"],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
    // Source map tắt trên production (bảo mật + giảm dung lượng)
    sourcemap: false,
  },
}));
