import { backendFetch } from "@/lib/server/backend-client";
import { password } from "@/lib/validation/auth-schemas";

export async function POST(request: Request) {
  const badInput = () =>
    Response.json(
      { message: "Invalid invitation or password." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return badInput();
    body = JSON.parse(text);
  } catch {
    return badInput();
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return badInput();
  const value = body as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => key !== "token" && key !== "password") ||
    typeof value.token !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.token) ||
    !password.safeParse(value.password).success
  )
    return badInput();
  const response = await backendFetch("/ops/invitations/accept", {
    method: "POST",
    cache: "no-store",
    body: JSON.stringify({ token: value.token, password: value.password }),
  });
  // Return an allowlisted response: never relay credentials, headers or backend details.
  if (response.ok)
    return Response.json(
      { accepted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(
    {
      message:
        response.status === 429
          ? "Too many attempts. Please try again later."
          : "Unable to accept this invitation.",
    },
    {
      status:
        response.status >= 400 && response.status <= 599
          ? response.status
          : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
