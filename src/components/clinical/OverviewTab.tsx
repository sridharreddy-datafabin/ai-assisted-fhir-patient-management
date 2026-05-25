import { useQueries } from "@tanstack/react-query";
import {
  getConditions,
  getMedications,
  getVitals,
  codeDisplay,
  medicationName,
  observationCode,
  observationDate,
  calculateAge,
  VITAL_CODES,
  type FhirPatient,
  type FhirObservation,
} from "@/lib/fhir";
import { LoadingState, ErrorState } from "./StateViews";
import { Activity, Heart, Pill, Stethoscope } from "lucide-react";

const VITAL_LABELS: Record<string, { label: string; unit: string }> = {
  [VITAL_CODES.heartRate]: { label: "Heart rate", unit: "bpm" },
  [VITAL_CODES.temperature]: { label: "Temperature", unit: "°C" },
  [VITAL_CODES.respiratoryRate]: { label: "Respiratory rate", unit: "/min" },
  [VITAL_CODES.oxygenSaturation]: { label: "O₂ saturation", unit: "%" },
  [VITAL_CODES.height]: { label: "Height", unit: "cm" },
  [VITAL_CODES.weight]: { label: "Weight", unit: "kg" },
  [VITAL_CODES.bmi]: { label: "BMI", unit: "kg/m²" },
  [VITAL_CODES.bloodPressure]: { label: "Blood pressure", unit: "mmHg" },
};

function latestByCode(obs: FhirObservation[]) {
  const map = new Map<string, FhirObservation>();
  for (const o of obs) {
    const code = observationCode(o);
    if (!code) continue;
    const d = observationDate(o) ?? "";
    const existing = map.get(code);
    if (!existing || (observationDate(existing) ?? "") < d) map.set(code, o);
  }
  return map;
}

function renderVitalValue(code: string, o: FhirObservation): string {
  if (code === VITAL_CODES.bloodPressure && o.component?.length) {
    const sys = o.component.find((c) => c.code?.coding?.some((cc) => cc.code === "8480-6"))
      ?.valueQuantity?.value;
    const dia = o.component.find((c) => c.code?.coding?.some((cc) => cc.code === "8462-4"))
      ?.valueQuantity?.value;
    if (sys != null && dia != null) return `${sys}/${dia} mmHg`;
  }
  const v = o.valueQuantity?.value;
  const u = o.valueQuantity?.unit ?? VITAL_LABELS[code]?.unit ?? "";
  return v != null ? `${v} ${u}`.trim() : "—";
}

export function OverviewTab({ patient }: { patient: FhirPatient }) {
  const id = patient.id!;
  const results = useQueries({
    queries: [
      { queryKey: ["conditions", id], queryFn: () => getConditions(id) },
      { queryKey: ["medications", id], queryFn: () => getMedications(id) },
      { queryKey: ["vitals", id], queryFn: () => getVitals(id) },
    ],
  });
  const [conditionsQ, medsQ, vitalsQ] = results;

  if (results.some((r) => r.isLoading)) return <LoadingState label="Loading overview..." />;
  const err = results.find((r) => r.error)?.error;
  if (err)
    return (
      <ErrorState
        message={err instanceof Error ? err.message : "Failed to load overview"}
        onRetry={() => results.forEach((r) => r.refetch())}
      />
    );

  const conditions = conditionsQ.data ?? [];
  const meds = medsQ.data ?? [];
  const vitals = vitalsQ.data ?? [];
  const age = calculateAge(patient.birthDate);
  const activeConditions = conditions.filter((c) => {
    const status = c.clinicalStatus?.coding?.[0]?.code ?? "";
    return !status || status === "active";
  });
  const activeMeds = meds.filter((m) => m.status === "active");
  const latest = latestByCode(vitals);

  const stats = [
    { label: "Active conditions", value: activeConditions.length, icon: Stethoscope },
    { label: "Active medications", value: activeMeds.length, icon: Pill },
    { label: "Vital records", value: vitals.length, icon: Activity },
    { label: "Age", value: age != null ? `${age}` : "—", icon: Heart },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Latest vitals</h3>
          </header>
          {latest.size === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No vital observations.</p>
          ) : (
            <ul className="divide-y divide-border">
              {Array.from(latest.entries()).map(([code, o]) => (
                <li key={code} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    {VITAL_LABELS[code]?.label ?? codeDisplay(o.code)}
                  </span>
                  <span className="font-medium text-foreground">{renderVitalValue(code, o)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card shadow-sm">
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Active conditions</h3>
          </header>
          {activeConditions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No active conditions.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activeConditions.slice(0, 6).map((c) => (
                <li key={c.id} className="px-4 py-2.5 text-sm text-foreground">
                  {codeDisplay(c.code)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card shadow-sm lg:col-span-2">
          <header className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Active medications</h3>
          </header>
          {activeMeds.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No active medications.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activeMeds.slice(0, 8).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span className="font-medium text-foreground">{medicationName(m)}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.authoredOn?.slice(0, 10) ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
