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
      port: 5173,
      strictPort: true,
      allowedHosts: [
        "famkon.site",
        "www.famkon.site",
        "localhost",
        "127.0.0.1",
        "24.144.102.159",
      ],
      watch: {
        usePolling: true,
      },
      // Proxy solo en desarrollo - en producción Nginx maneja /api → backend:5299
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
    // Para build de producción: define la URL base de la API via variable de entorno
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
        process.env.VITE_API_BASE_URL || "/api/famkon"
      ),
    },
  };
});