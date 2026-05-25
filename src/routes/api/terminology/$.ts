import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

async function proxy({ request, params }: { request: Request; params: { _splat?: string } }) {
  const baseUrl = process.env.ONTOSERVER_BASE_URL;
  const token = process.env.ONTOSERVER_BEARER_TOKEN;

  if (!baseUrl) {
    console.error("OntoServer proxy misconfigured: ONTOSERVER_BASE_URL not set");
    return new Response(
      JSON.stringify({ error: "Terminology service unavailable: ONTOSERVER_BASE_URL not set" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const path = params._splat ?? "";
  const incomingUrl = new URL(request.url);
  const target = `${baseUrl.replace(/\/$/, "")}/${path}${incomingUrl.search}`;

  const headers: Record<string, string> = {
    Accept: "application/fhir+json",
  };
  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token}`;
  }
  const ct = request.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;

  const init: RequestInit = { method: request.method, headers };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch (err) {
    console.error("OntoServer proxy network failure:", err);
    return new Response(
      JSON.stringify({
        error: "Network failure contacting terminology server",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/fhir+json";

  // Non-JSON response — wrap so the frontend always gets JSON back.
  if (!contentType.includes("json")) {
    return new Response(
      JSON.stringify({
        error: "Non-JSON response from terminology server",
        status: res.status,
        contentType,
        body: body.slice(0, 500),
      }),
      { status: res.ok ? 502 : res.status, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": contentType },
  });
}

const handlers = Object.fromEntries(ALLOWED_METHODS.map((m) => [m, proxy]));

export const Route = createFileRoute("/api/terminology/$")({
  server: { handlers },
});
