import { createServer } from "vite";

const server = await createServer({ configFile: "./vite.config.ts" });
await server.listen();
server.printUrls();

let cerrando = false;
function apagar() {
  if (cerrando) return;
  cerrando = true;
  console.log("\nDeteniendo Vite...");
  server
    .close()
    .catch(() => {})
    .finally(() => process.exit(0));
}

process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
process.on("SIGHUP", apagar);