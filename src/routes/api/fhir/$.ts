import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

async function proxy({ request, params }: { request: Request; params: { _splat?: string } }) {
  const baseUrl = process.env.FHIR_BASE_URL;
  const token = process.env.FHIR_BEARER_TOKEN;
  if (!baseUrl || !token) {
    return new Response(
      JSON.stringify({ error: "FHIR_BASE_URL or FHIR_BEARER_TOKEN not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const incomingUrl = new URL(request.url);
  const path = params._splat ?? "";
  const target = `${baseUrl.replace(/\/$/, "")}/${path}${incomingUrl.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/fhir+json",
  };
  const ct = request.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;

  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  const res = await fetch(target, init);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/fhir+json",
    },
  });
}

const handlers = Object.fromEntries(ALLOWED_METHODS.map((m) => [m, proxy]));

export const Route = createFileRoute("/api/fhir/$")({
  server: { handlers },
});
