import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5147,
      strictPort: true,
      allowedHosts: [
        "famkon.site",
        "www.famkon.site",
        "localhost",
        "127.0.0.1",
        "212.47.75.12",
        ".ngrok.io",
        ".ngrok-free.app",
      ],
      watch: {
        usePolling: true,
      },
      // Proxy solo en desarrollo
      ...(isDev && {
        proxy: {
          "/api": {
            target: "http://localhost:5299",
            changeOrigin: true,
            secure: false,
          },
        },
      }),
    },
    // En producción, apuntamos al subdominio seguro de la API
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
        process.env.VITE_API_BASE_URL || (isDev ? "/api/famkon" : "https://api.famkon.site")
      ),
    },
  };
});
