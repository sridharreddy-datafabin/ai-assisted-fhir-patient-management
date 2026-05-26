export type Gender = "male" | "female" | "other" | "unknown";

export interface FhirHumanName {
  given?: string[];
  family?: string;
  use?: string;
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  text?: string;
  coding?: FhirCoding[];
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirIdentifier {
  use?: string;
  system?: string;
  value?: string;
  type?: FhirCodeableConcept;
}

export interface FhirPatient {
  resourceType: "Patient";
  id?: string;
  identifier?: FhirIdentifier[];
  name?: FhirHumanName[];
  gender?: Gender;
  birthDate?: string;
}

export function patientIdentifier(p: FhirPatient): string | null {
  const ids = p.identifier ?? [];
  if (ids.length === 0) return null;
  const usual = ids.find((i) => i.use === "usual" && i.value);
  const official = ids.find((i) => i.use === "official" && i.value);
  const mr = ids.find((i) =>
    i.type?.coding?.some((c) => c.code === "MR"),
  );
  const first = ids.find((i) => i.value);
  return (usual ?? official ?? mr ?? first)?.value ?? null;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  code?: string;
  system?: string;
}

export interface FhirObservationComponent {
  code?: FhirCodeableConcept;
  valueQuantity?: FhirQuantity;
}

export interface FhirObservation {
  resourceType: "Observation";
  id?: string;
  status?: string;
  code?: FhirCodeableConcept;
  effectiveDateTime?: string;
  issued?: string;
  valueQuantity?: FhirQuantity;
  component?: FhirObservationComponent[];
}

export interface FhirCondition {
  resourceType: "Condition";
  id?: string;
  code?: FhirCodeableConcept;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  onsetDateTime?: string;
  recordedDate?: string;
}

export interface FhirMedication {
  resourceType: "Medication";
  id?: string;
  code?: FhirCodeableConcept;
}

export interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id?: string;
  status?: string;
  intent?: string;
  authoredOn?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  medicationReference?: FhirReference;
}

export interface ResolvedMedicationRequest extends FhirMedicationRequest {
  _resolvedMedication?: FhirMedication;
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

function entries<T>(bundle: FhirBundle<T>): T[] {
  return (bundle.entry ?? []).map((e) => e.resource);
}

export async function searchPatients(name?: string): Promise<FhirPatient[]> {
  const params = new URLSearchParams({ _count: "20", _sort: "-_lastUpdated" });
  if (name && name.trim()) params.set("name", name.trim());
  const res = await fetch(`${BASE}/Patient?${params.toString()}`);
  const bundle = (await handle(res)) as FhirBundle<FhirPatient>;
  return entries(bundle);
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

export const VITAL_CODES = {
  heartRate: "8867-4",
  temperature: "8310-5",
  temperatureOral: "8331-1",
  temperatureBody: "8331-0",
  respiratoryRate: "9279-1",
  oxygenSaturation: "59408-5",
  oxygenSaturationAlt: "2708-6",
  height: "8302-2",
  weight: "29463-7",
  bmi: "39156-5",
  bloodPressure: "55284-4",
  bloodPressurePanel: "85354-9",
} as const;

export async function getVitals(patientId: string): Promise<FhirObservation[]> {
  const codes = Object.values(VITAL_CODES).join(",");
  const params = new URLSearchParams({
    subject: `Patient/${patientId}`,
    code: codes,
    _count: "500",
    _sort: "date",
  });
  const res = await fetch(`${BASE}/Observation?${params.toString()}`);
  const bundle = (await handle(res)) as FhirBundle<FhirObservation>;
  return entries(bundle);
}

export async function getConditions(patientId: string): Promise<FhirCondition[]> {
  const params = new URLSearchParams({ patient: patientId, _count: "200" });
  const res = await fetch(`${BASE}/Condition?${params.toString()}`);
  const bundle = (await handle(res)) as FhirBundle<FhirCondition>;
  return entries(bundle);
}

export async function getMedications(
  patientId: string,
): Promise<ResolvedMedicationRequest[]> {
  const params = new URLSearchParams({
    patient: patientId,
    _count: "200",
    _include: "MedicationRequest:medication",
  });
  const res = await fetch(`${BASE}/MedicationRequest?${params.toString()}`);
  const bundle = (await handle(res)) as FhirBundle<
    FhirMedicationRequest | FhirMedication
  >;
  const all = entries(bundle);

  // Index included Medication resources by id (and full reference form).
  const meds = new Map<string, FhirMedication>();
  for (const r of all) {
    if (r.resourceType === "Medication" && r.id) {
      meds.set(r.id, r);
      meds.set(`Medication/${r.id}`, r);
    }
  }

  // Return only MedicationRequests, with the resolved Medication attached.
  return all
    .filter((r): r is FhirMedicationRequest => r.resourceType === "MedicationRequest")
    .map((mr) => {
      const ref = mr.medicationReference?.reference;
      let resolved: FhirMedication | undefined;
      if (ref) {
        // Reference can be "Medication/123" or a urn:uuid:... or contained "#id".
        resolved = meds.get(ref);
        if (!resolved) {
          const id = ref.split("/").pop();
          if (id) resolved = meds.get(id);
        }
      }
      return { ...mr, _resolvedMedication: resolved };
    });
}

export function formatPatientName(p: FhirPatient): string {
  const n = p.name?.[0];
  if (!n) return "(no name)";
  const given = (n.given ?? []).join(" ");
  return [given, n.family].filter(Boolean).join(" ") || "(no name)";
}

export function codeDisplay(c?: FhirCodeableConcept): string {
  if (!c) return "—";
  return c.text || c.coding?.[0]?.display || c.coding?.[0]?.code || "—";
}

export function medicationName(m: ResolvedMedicationRequest): string {
  if (m.medicationCodeableConcept) return codeDisplay(m.medicationCodeableConcept);
  if (m._resolvedMedication?.code) return codeDisplay(m._resolvedMedication.code);
  if (m.medicationReference)
    return m.medicationReference.display || m.medicationReference.reference || "—";
  return "—";
}

export function observationCode(o: FhirObservation): string | undefined {
  return o.code?.coding?.find((c) => c.system?.includes("loinc") || /^\d/.test(c.code ?? ""))
    ?.code ?? o.code?.coding?.[0]?.code;
}

export function observationDate(o: FhirObservation): string | undefined {
  return o.effectiveDateTime || o.issued;
}

export function calculateAge(birthDate?: string): number | undefined {
  if (!birthDate) return undefined;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : undefined;
}

