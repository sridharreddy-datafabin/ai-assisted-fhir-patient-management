export type Gender = "male" | "female" | "other" | "unknown";

export interface FhirHumanName {
  given?: string[];
  family?: string;
  use?: string;
}

export interface FhirPatient {
  resourceType: "Patient";
  id?: string;
  name?: FhirHumanName[];
  gender?: Gender;
  birthDate?: string;
}

export interface FhirBundle<T> {
  resourceType: "Bundle";
  entry?: Array<{ resource: T }>;
  total?: number;
}

const BASE = "/api/fhir";

async function handle(res: Response) {
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      json?.issue?.[0]?.diagnostics ||
      json?.error ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

export async function searchPatients(name?: string): Promise<FhirPatient[]> {
  const params = new URLSearchParams({ _count: "20" });
  if (name && name.trim()) params.set("name", name.trim());
  const res = await fetch(`${BASE}/Patient?${params.toString()}`);
  const bundle = (await handle(res)) as FhirBundle<FhirPatient>;
  return (bundle.entry ?? []).map((e) => e.resource);
}

export async function getPatient(id: string): Promise<FhirPatient> {
  const res = await fetch(`${BASE}/Patient/${encodeURIComponent(id)}`);
  return handle(res);
}

export async function createPatient(p: FhirPatient): Promise<FhirPatient> {
  const res = await fetch(`${BASE}/Patient`, {
    method: "POST",
    headers: { "Content-Type": "application/fhir+json" },
    body: JSON.stringify(p),
  });
  return handle(res);
}

export async function updatePatient(id: string, p: FhirPatient): Promise<FhirPatient> {
  const res = await fetch(`${BASE}/Patient/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/fhir+json" },
    body: JSON.stringify({ ...p, id }),
  });
  return handle(res);
}

export function formatPatientName(p: FhirPatient): string {
  const n = p.name?.[0];
  if (!n) return "(no name)";
  const given = (n.given ?? []).join(" ");
  return [given, n.family].filter(Boolean).join(" ") || "(no name)";
}
