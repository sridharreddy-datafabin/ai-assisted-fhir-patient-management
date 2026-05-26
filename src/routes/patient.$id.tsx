import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/clinical/BrandMark";
import {
  getPatient,
  formatPatientName,
  calculateAge,
  patientIdentifier,
  type FhirPatient,
} from "@/lib/fhir";
import { LoadingState, ErrorState } from "@/components/clinical/StateViews";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VitalsTab } from "@/components/clinical/VitalsTab";
import { ConditionsTab } from "@/components/clinical/ConditionsTab";
import { MedicationsTab } from "@/components/clinical/MedicationsTab";
import { OverviewTab } from "@/components/clinical/OverviewTab";
import { ClinicalNotesTab } from "@/components/clinical/ClinicalNotesTab";
import { WorkflowSummaryTab } from "@/components/clinical/WorkflowSummaryTab";
import { EncountersTab } from "@/components/clinical/EncountersTab";
import { AnalyticsTab } from "@/components/clinical/AnalyticsTab";


export const Route = createFileRoute("/patient/$id")({
  component: PatientDetailPage,
});

function GenderBadge({ gender }: { gender?: string }) {
  const g = (gender ?? "").toLowerCase();
  if (g === "female")
    return (
      <span className="inline-flex items-center rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
        Female
      </span>
    );
  if (g === "male")
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
        Male
      </span>
    );
  return <span className="text-muted-foreground capitalize">{gender ?? "—"}</span>;
}

function Demographics({ patient }: { patient: FhirPatient }) {
  const age = calculateAge(patient.birthDate);
  const mrn = patientIdentifier(patient);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-primary via-[oklch(0.5_0.13_220)] to-[oklch(0.65_0.14_195)]" />
      <div className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">
              {formatPatientName(patient)}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <GenderBadge gender={patient.gender} />
              {age != null && (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Age {age}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date of birth</div>
              <div className="mt-1 font-medium text-foreground">{patient.birthDate ?? "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Age</div>
              <div className="mt-1 font-medium text-foreground">{age != null ? `${age}` : "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Patient ID</div>
              <div
                className="mt-1 truncate font-medium text-foreground"
                title={mrn ?? undefined}
              >
                {mrn ?? (
                  <span className="text-muted-foreground italic">No patient identifier available</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">FHIR ID</div>
              <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                {patient.id ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function PatientDetailPage() {
  const { id } = Route.useParams();
  const [activeTab, setActiveTab] = useState("overview");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => getPatient(id),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <BrandMark />

          <div className="flex items-center gap-4">
            <Link
              to="/business-case"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Business Case
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to patients
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {isLoading ? (
          <LoadingState label="Loading patient..." />
        ) : error ? (
          <ErrorState
            message={error instanceof Error ? error.message : "Failed to load patient"}
            onRetry={() => refetch()}
          />
        ) : data ? (
          <>
            <Demographics patient={data} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="vitals">Vitals</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
                <TabsTrigger value="medications">Medications</TabsTrigger>
                <TabsTrigger value="encounters">Encounters</TabsTrigger>
                <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
                <TabsTrigger value="workflow">Workflow Summary</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <OverviewTab patient={data} />
              </TabsContent>

              <TabsContent value="vitals">
                <VitalsTab patientId={id} />
              </TabsContent>
              <TabsContent value="conditions">
                <ConditionsTab patientId={id} patient={data} />
              </TabsContent>
              <TabsContent value="medications">
                <MedicationsTab patientId={id} />
              </TabsContent>
              <TabsContent value="encounters">
                <EncountersTab patientId={id} onOpenWorkflow={() => setActiveTab("workflow")} />
              </TabsContent>
              <TabsContent value="notes">
                <ClinicalNotesTab patient={data} />
              </TabsContent>
              <TabsContent value="workflow">
                <WorkflowSummaryTab patient={data} />
              </TabsContent>
              <TabsContent value="analytics">
                <AnalyticsTab patientId={id} onOpenWorkflow={() => setActiveTab("workflow")} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </main>
    </div>
  );
}
