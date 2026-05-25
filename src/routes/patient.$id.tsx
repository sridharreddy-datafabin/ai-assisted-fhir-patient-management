import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import {
  getPatient,
  formatPatientName,
  calculateAge,
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
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{formatPatientName(patient)}</h2>
          {age != null && (
            <p className="mt-1 text-sm text-muted-foreground">{age} years old</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Gender</div>
            <div className="mt-1"><GenderBadge gender={patient.gender} /></div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Date of birth</div>
            <div className="mt-1 font-medium text-foreground">{patient.birthDate ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Age</div>
            <div className="mt-1 font-medium text-foreground">{age != null ? `${age}` : "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Patient ID</div>
            <div className="mt-1 break-all font-mono text-xs text-foreground">{patient.id ?? "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}


function PatientDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => getPatient(id),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Patient Management" className="h-7 w-7" />
            <h1 className="text-lg font-semibold text-foreground">Patient Management</h1>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patients
          </Link>
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

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="vitals">Vitals</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
                <TabsTrigger value="medications">Medications</TabsTrigger>
                <TabsTrigger value="encounters">Encounters</TabsTrigger>
                <TabsTrigger value="notes">Clinical Notes</TabsTrigger>
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
                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                  Encounters coming soon.
                </div>
              </TabsContent>
              <TabsContent value="notes">
                <ClinicalNotesTab patient={data} />
              </TabsContent>
              <TabsContent value="analytics">
                <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                  Analytics coming soon.
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </main>
    </div>
  );
}
