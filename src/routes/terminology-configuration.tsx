import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import {
  ChevronLeft,
  Server,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Circle,
  Lock,
  Map as MapIcon,
  Code,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/terminology-configuration")({
  component: TerminologyConfigurationPage,
});

function StatusCard({
  label,
  value,
  variant = "neutral",
}: {
  label: string;
  value: string;
  variant?: "neutral" | "success" | "warning" | "error" | "info";
}) {
  const variantClasses = {
    neutral: "bg-muted/40 text-foreground",
    success: "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800",
    warning: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
    error: "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800",
    info: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800",
  };
  return (
    <div className={`rounded-md border p-3 ${variantClasses[variant]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right break-all">{value}</span>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

function TerminologyConfigurationPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Patient Management" className="h-7 w-7" />
            <h1 className="text-lg font-semibold text-foreground">Patient Management</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/business-case"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Business Case
            </Link>
            <Link
              to="/terminology"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Terminology Search
            </Link>
            <span className="text-xs text-muted-foreground">FHIR R4</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Terminology Configuration</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only view of the current terminology integration and future SNOMED setup.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to patients
          </Link>
        </div>

        <Section title="Terminology server status" icon={Server}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatusCard
              label="Provider"
              value="NHS England Terminology Server / OntoServer"
              variant="info"
            />
            <StatusCard
              label="Base URL"
              value="NHS production terminology server (masked)"
              variant="neutral"
            />
            <StatusCard
              label="Authentication status"
              value="Credentials pending"
              variant="warning"
            />
            <StatusCard
              label="Current app behaviour"
              value="Requests route through /api/terminology"
              variant="info"
            />
            <StatusCard
              label="Browser safety"
              value="Credentials are not exposed in the frontend"
              variant="success"
            />
            <StatusCard
              label="Proxy route"
              value="/api/terminology/*"
              variant="neutral"
            />
          </div>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Authentication required</div>
                <div className="text-xs opacity-90">
                  NHS Terminology Server credentials are pending. The app is already wired for secure terminology access. Once system-to-system credentials are configured server-side, live SNOMED search and validation can be enabled without changing the frontend workflow.
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="SNOMED search configuration" icon={Search}>
          <div className="space-y-1">
            <ConfigRow label="Operation" value="ValueSet/$expand" />
            <ConfigRow
              label="Default ValueSet URL"
              value="http://snomed.info/sct?fhir_vs"
            />
            <ConfigRow label="Search filter parameter" value="filter" />
            <ConfigRow label="Result count" value="20" />
            <ConfigRow
              label="Current status"
              value="Ready, authentication pending"
            />
          </div>
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              The SNOMED search UI is ready in{" "}
              <Link to="/terminology" className="font-medium underline hover:text-foreground">
                Terminology Search
              </Link>
              . Live search responses depend on the upstream OntoServer credentials.
            </p>
          </div>
        </Section>

        <Section title="SNOMED validation configuration" icon={ShieldCheck}>
          <div className="space-y-1">
            <ConfigRow label="Operation" value="CodeSystem/$validate-code" />
            <ConfigRow
              label="Code system"
              value="http://snomed.info/sct"
            />
            <ConfigRow
              label="Used in"
              value="Patient Conditions tab"
            />
            <ConfigRow
              label="Current status"
              value="Ready, authentication pending"
            />
          </div>
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              Validation is triggered manually per condition from the patient Conditions tab. Results are session-only and are not persisted to the FHIR server.
            </p>
          </div>
        </Section>

        <Section title="Mapping configuration" icon={MapIcon}>
          <div className="space-y-1">
            <ConfigRow label="Future operation" value="ConceptMap/$translate" />
            <ConfigRow label="Source system" value="SNOMED CT" />
            <ConfigRow label="Target system 1" value="ICD-10" />
            <ConfigRow label="Target system 2" value="Local code" />
            <ConfigRow label="Target system 3" value="Reporting category" />
            <ConfigRow
              label="Current status"
              value="Disabled until credentials and ConceptMap details are confirmed"
            />
          </div>
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              Mapping preview is available in the Add Coded Condition workflow. Live mapping requires a configured ConceptMap and authenticated terminology access.
            </p>
          </div>
        </Section>

        <Section title="Integration checklist" icon={CheckCircle2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Completed</h3>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <ChecklistItem done label="Backend terminology proxy created" />
                <ChecklistItem done label="SNOMED search UI created" />
                <ChecklistItem done label="SNOMED validation framework created" />
                <ChecklistItem done label="Add coded condition preview created" />
                <ChecklistItem done label="Mapping preview placeholder created" />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Pending</h3>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <ChecklistItem done={false} label="NHS system-to-system credentials requested" />
                <ChecklistItem done={false} label="Token-based authentication pending" />
                <ChecklistItem done={false} label="Live SNOMED search pending" />
                <ChecklistItem done={false} label="Live validation pending" />
                <ChecklistItem done={false} label="Live mapping pending" />
              </div>
            </div>
          </div>
        </Section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Security note</h2>
          </div>
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-100">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Credentials are server-side only</p>
                <p>
                  Terminology credentials must be stored server-side only. The browser calls{" "}
                  <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">/api/terminology</code>{" "}
                  and must never receive NHS client secrets or bearer tokens.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  <li>The browser never calls https://ontology.nhs.uk/production1/fhir directly.</li>
                  <li>ONTOSERVER_BASE_URL is only used by the backend proxy.</li>
                  <li>ONTOSERVER_BEARER_TOKEN is only used by the backend proxy.</li>
                  <li>The Authorization header is injected by the proxy, not the browser.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
