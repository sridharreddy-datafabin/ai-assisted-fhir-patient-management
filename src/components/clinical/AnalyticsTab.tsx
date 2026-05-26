import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useWorkflowSnapshot } from "@/lib/workflow-store";
import { getConditions, getMedications, getVitals } from "@/lib/fhir";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Info,
  LayoutDashboard,
  Stethoscope,
  XCircle,
} from "lucide-react";

interface Props {
  patientId: string;
  onOpenWorkflow: () => void;
}

export function AnalyticsTab({ patientId, onOpenWorkflow }: Props) {
  const live = useWorkflowSnapshot(patientId);

  const results = useQueries({
    queries: [
      { queryKey: ["conditions", patientId], queryFn: () => getConditions(patientId), enabled: !!patientId },
      { queryKey: ["medications", patientId], queryFn: () => getMedications(patientId), enabled: !!patientId },
      { queryKey: ["vitals", patientId], queryFn: () => getVitals(patientId), enabled: !!patientId },
    ],
  });
  const [condQ, medQ, vitQ] = results;

  const fhirLoaded = results.every((r) => r.isSuccess);
  const fhirLoading = results.some((r) => r.isLoading);

  const condCount = condQ.isSuccess ? condQ.data?.length ?? 0 : undefined;
  const medCount = medQ.isSuccess ? medQ.data?.length ?? 0 : undefined;
  const vitCount = vitQ.isSuccess ? vitQ.data?.length ?? 0 : undefined;

  const readyForFhirSave = false;

  const cards = useMemo(
    () => [
      {
        label: "Patient record loaded",
        status: fhirLoaded ? ("yes" as const) : fhirLoading ? ("loading" as const) : ("no" as const),
        value: fhirLoaded ? "Yes" : fhirLoading ? "Loading…" : "No",
      },
      {
        label: "Conditions available",
        status:
          condCount !== undefined
            ? condCount > 0
              ? ("yes" as const)
              : ("no" as const)
            : ("loading" as const),
        value:
          condCount !== undefined
            ? condCount > 0
              ? `${condCount} available`
              : "None"
            : "—",
      },
      {
        label: "Vitals available",
        status:
          vitCount !== undefined
            ? vitCount > 0
              ? ("yes" as const)
              : ("no" as const)
            : ("loading" as const),
        value:
          vitCount !== undefined
            ? vitCount > 0
              ? `${vitCount} available`
              : "None"
            : "—",
      },
      {
        label: "Medications available",
        status:
          medCount !== undefined
            ? medCount > 0
              ? ("yes" as const)
              : ("no" as const)
            : ("loading" as const),
        value:
          medCount !== undefined
            ? medCount > 0
              ? `${medCount} available`
              : "None"
            : "—",
      },
      {
        label: "NLP candidates reviewed",
        status: live && live.totalCandidates > 0 ? ("yes" as const) : ("no" as const),
        value:
          live && live.totalCandidates > 0
            ? `${live.reviewedCount ?? 0} of ${live.totalCandidates} reviewed`
            : "None",
      },
      {
        label: "Ready for FHIR save",
        status: readyForFhirSave ? ("yes" as const) : ("no" as const),
        value: readyForFhirSave ? "Yes" : "No",
      },
    ],
    [fhirLoaded, fhirLoading, condCount, medCount, vitCount, live, readyForFhirSave]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Structured FHIR and terminology-coded data can support reporting, dashboards, and care quality insights.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenWorkflow}>
            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
            Open Workflow Summary
          </Button>
        </div>
      </section>

      {/* Summary cards */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Summary</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.label}
              className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {c.label}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StatusIcon status={c.status} />
                <span className="text-base font-semibold text-foreground">{c.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Analytics readiness */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Analytics readiness depends on
        </h3>
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
          <li>Structured FHIR resources</li>
          <li>SNOMED-coded conditions</li>
          <li>Terminology validation</li>
          <li>Clinician approval</li>
          <li>Final sign-off before saving</li>
        </ul>
      </section>

      {/* Future analytics examples */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Future analytics examples</h3>
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
          <li>Condition prevalence by SNOMED code</li>
          <li>Coding completeness</li>
          <li>NLP candidate acceptance rate</li>
          <li>Negated/family-history exclusion rate</li>
          <li>Clinician review workload</li>
          <li>Patients with pending coding validation</li>
          <li>Data quality dashboard for interoperability teams</li>
        </ul>
      </section>

      {/* Note */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Analytics in this prototype are preview-only and session-based. Production analytics would use persisted FHIR resources and validated terminology-coded data.
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: "yes" | "no" | "loading" }) {
  if (status === "yes")
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "loading")
    return <Clock className="h-4 w-4 shrink-0 text-sky-600" />;
  return <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />;
}
