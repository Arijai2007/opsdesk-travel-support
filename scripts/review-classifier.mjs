import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function createReviewServer() {
  const assets = new Map(
    [
      ["/", ["./classifier-review/index.html", "text/html"]],
      ["/review.mjs", ["./classifier-review/review.mjs", "text/javascript"]],
      ["/review.css", ["./classifier-review/review.css", "text/css"]],
      ["/validation.mjs", ["./classifier-evaluation.mjs", "text/javascript"]],
      [
        "/starter.json",
        ["./fixtures/travel-classifier-review.json", "application/json"],
      ],
    ].map(([path, [file, type]]) => [
      path,
      { body: readFileSync(new URL(file, import.meta.url)), type },
    ]),
  );
  return createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" });
      response.end("Read-only review tool.");
      return;
    }
    const asset = assets.get(new URL(request.url, "http://127.0.0.1").pathname);
    if (!asset) {
      response.writeHead(404);
      response.end("Not found.");
      return;
    }
    response.writeHead(200, { "Content-Type": `${asset.type}; charset=utf-8` });
    response.end(asset.body);
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.OPSDESK_REVIEW_PORT || 3330);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error(
      "OPSDESK_REVIEW_PORT must be an integer from 1024 to 65535.",
    );
  const server = createReviewServer();
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `Blind classifier review: http://127.0.0.1:${port}\nNo application/database or model credentials are required. Ctrl+C stops the read-only server.`,
    ),
  );
}
