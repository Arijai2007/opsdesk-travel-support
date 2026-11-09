import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const backend = new URL("backend/.env", root);
if (!existsSync(backend)) {
  const password = randomBytes(18).toString("hex");
  writeFileSync(
    backend,
    `NODE_ENV=development\nHOST=127.0.0.1\nPORT=3001\nFRONTEND_URL=http://localhost:3000\nJWT_SECRET=${randomBytes(32).toString("hex")}\nJWT_REFRESH_SECRET=${randomBytes(32).toString("hex")}\nDATABASE_URL=postgresql://opsdesk:${password}@127.0.0.1:55432/opsdesk\nLOCAL_POSTGRES_PASSWORD=${password}\nOPSDESK_LOCAL_COUNTERS=true\nOPSDESK_DEMO=true\nGEMINI_API_KEY=\nREDIS_URL=redis://localhost:6379\nTURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA\n`,
  );
}
const frontend = new URL("frontend/.env.local", root);
if (!existsSync(frontend))
  writeFileSync(frontend, "BACKEND_API_URL=http://127.0.0.1:3001\n");
console.log(
  `Local configuration ready at ${fileURLToPath(root)}. Existing env files were preserved.`,
);
