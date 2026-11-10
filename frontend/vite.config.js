import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Charge TOUTES les variables de frontend/.env (y compris celles sans préfixe VITE_).
  // PINATA_JWT reste côté serveur : il n'est jamais injecté dans le code du navigateur.
  const env = loadEnv(mode, process.cwd(), "");
  const jwt = env.PINATA_JWT;

  const proxy = jwt
    ? {
        "/api/pinata": {
          target: "https://api.pinata.cloud",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/pinata/, ""),
          headers: { Authorization: `Bearer ${jwt}` },
        },
      }
    : undefined;

  return {
    plugins: [react()],
    // Seul un booléen est exposé au navigateur : "Pinata est-il configuré ?"
    define: { __PINATA_ENABLED__: JSON.stringify(Boolean(jwt)) },
    server: { proxy },
    preview: { proxy },
  };
});
