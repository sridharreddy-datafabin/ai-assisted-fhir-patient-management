import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Cpu,
  FileText,
  Globe,
  Layers,
  LayoutList,
  ListChecks,
  Lock,
  RefreshCw,
  ScanText,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/business-case")({
  head: () => ({
    meta: [
      { title: "Business Case — AI-Assisted Interoperable Patient Management Platform" },
      { name: "description", content: "FHIR-native workflow for turning fragmented patient data and unstructured clinical notes into reviewed, structured, terminology-ready healthcare data." },
      { property: "og:title", content: "Business Case — AI-Assisted Interoperable Patient Management Platform" },
      { property: "og:description", content: "FHIR-native workflow for turning fragmented patient data and unstructured clinical notes into reviewed, structured, terminology-ready healthcare data." },
    ],
  }),
  component: BusinessCasePage,
});

function BusinessCasePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-sm ring-1 ring-primary/20">
              <img src={"logo"} alt="" className="h-6 w-6" />
            </div>
            <div className="flex flex-col leading-tight">
              <h1 className="text-base font-bold tracking-tight text-primary">Patient Management</h1>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Clinical Workspace</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-accent hover:text-accent-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-semibold bg-accent text-accent-foreground" }}
            >
              Patient Management
            </Link>
            <Link
              to="/terminology"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-accent hover:text-accent-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-semibold bg-accent text-accent-foreground" }}
            >
              Terminology Search
            </Link>
            <Link
              to="/terminology-configuration"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-accent hover:text-accent-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-semibold bg-accent text-accent-foreground" }}
            >
              Configuration
            </Link>
            <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              FHIR R4
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-6 py-10">
        {/* 1. Product title */}
        <section className="text-center">
          <h1 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            AI-Assisted Interoperable Patient Management Platform
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            A FHIR-native workflow for turning fragmented patient data and unstructured clinical notes into reviewed, structured, terminology-ready healthcare data.
          </p>
        </section>

        {/* 2. Who this app is for */}
        <section>
          <h2 className="mb-6 text-2xl font-bold text-foreground">Who this app is for</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ForCard
              icon={<Stethoscope className="h-5 w-5 text-primary" />}
              title="Clinicians"
              description="Need faster review of patient problems without unsafe automation."
            />
            <ForCard
              icon={<Users className="h-5 w-5 text-primary" />}
              title="Care coordinators and admin teams"
              description="Need cleaner structured records and less manual data cleanup."
            />
            <ForCard
              icon={<Cpu className="h-5 w-5 text-primary" />}
              title="Health-tech builders"
              description="Need a practical pattern for FHIR, SNOMED, terminology validation, and AI-assisted workflows."
            />
            <ForCard
              icon={<Globe className="h-5 w-5 text-primary" />}
              title="Interoperability teams"
              description="Need reliable FHIR-native data that can support analytics, reporting, and downstream system exchange."
            />
          </div>
        </section>

        {/* 3. Problem statement */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-foreground">
            <AlertCircle className="h-6 w-6 text-destructive" />
            Problem statement
          </h2>
          <p className="mb-4 text-base text-muted-foreground">Healthcare teams often work with:</p>
          <ul className="space-y-2">
            {[
              "Fragmented patient records",
              "Unstructured clinical notes",
              "Inconsistent condition coding",
              "Manual administrative review",
              "Weak terminology validation",
              "Poor readiness for analytics and interoperability",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive/70" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            This increases clinician burden and reduces the quality of structured healthcare data.
          </p>
        </section>

        {/* 4. Solution summary */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-foreground">
            <RefreshCw className="h-6 w-6 text-primary" />
            Solution summary
          </h2>
          <p className="mb-4 text-base text-muted-foreground">
            This app demonstrates an end-to-end workflow that:
          </p>
          <ol className="space-y-2">
            {[
              "Loads patient data from a FHIR R4 backend",
              "Displays patient demographics, conditions, vitals, and medications",
              "Extracts candidate conditions from clinical notes",
              "Detects negation, family history, uncertainty, and historical context",
              "Flags duplicate or less-specific candidates",
              "Generates preview-only FHIR Condition resources",
              "Requires clinician approval before coding",
              "Hands approved items into a SNOMED coding workflow",
              "Requires terminology validation and final sign-off before future FHIR save",
            ].map((item, i) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </section>

        {/* 5. Core value proposition */}
        <section>
          <h2 className="mb-6 text-2xl font-bold text-foreground">Core value proposition</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ValueCard
              icon={<Layers className="h-5 w-5" />}
              title="Standardised structured healthcare data"
              description="Converts clinical information into FHIR-ready structured resources."
            />
            <ValueCard
              icon={<ScanText className="h-5 w-5" />}
              title="Intelligent workflow support"
              description="Helps users identify candidate conditions from free-text notes."
            />
            <ValueCard
              icon={<Clock className="h-5 w-5" />}
              title="Reduced clinician and admin effort"
              description="Supports review, coding, and sign-off instead of manual re-entry."
            />
            <ValueCard
              icon={<Globe className="h-5 w-5" />}
              title="Better interoperability"
              description="Uses FHIR R4 and terminology-ready workflows."
            />
            <ValueCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Safer clinical automation"
              description="No NLP result is saved automatically. Clinician approval is required."
            />
            <ValueCard
              icon={<Search className="h-5 w-5" />}
              title="Terminology-ready design"
              description="Uses a secure OntoServer/NHS Terminology Server proxy pattern."
            />
          </div>
        </section>

        {/* 6. Demo workflow */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Workflow className="h-6 w-6 text-primary" />
            Demo workflow
          </h2>
          <ol className="space-y-3">
            {[
              "Select patient",
              "Review FHIR patient record",
              "Review existing conditions and vitals",
              "Enter or load clinical note",
              "Extract candidate clinical concepts",
              "Review context and negation",
              "Resolve duplicate/specificity issues",
              "Generate FHIR Condition previews",
              "Approve clinically relevant candidates",
              "Send to SNOMED coding handoff",
              "Open terminology search with prefilled term",
              "Complete final sign-off checklist",
              "Ready for FHIR save only after coding, validation, and sign-off",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* 7. What is implemented */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-foreground">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
            What is implemented
          </h2>
          <p className="mb-4 text-base text-muted-foreground">Implemented in this prototype:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "FHIR patient list",
              "Patient details",
              "Conditions view",
              "Vitals view",
              "Medications view",
              "SNOMED validation framework",
              "Secure terminology proxy",
              "SNOMED search page",
              "Terminology configuration page",
              "NLP extraction workspace",
              "Negation and context handling",
              "Specificity and duplicate review",
              "FHIR Condition preview generation",
              "Clinician approval workflow",
              "SNOMED coding handoff",
              "Final clinical sign-off framework",
              "Workflow Summary dashboard",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* 8. Current prototype limitation */}
        <section className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold text-foreground">
            <XCircle className="h-6 w-6 text-destructive" />
            Current prototype limitation
          </h2>
          <p className="text-sm text-foreground">
            NHS Terminology Server system-to-system credentials have been requested but are not yet available. Until credentials are configured, live SNOMED search and validation return authentication-required responses.
          </p>
          <p className="mt-3 text-sm font-medium text-foreground">This is handled intentionally and safely:</p>
          <ul className="mt-2 space-y-1">
            {[
              "No credentials are exposed in the browser",
              "No fake SNOMED results are shown",
              "No terminology result is fabricated",
              "No FHIR Condition is saved without coding, validation, and sign-off",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* 9. Why this matters commercially */}
        <section>
          <h2 className="mb-6 text-2xl font-bold text-foreground">Why this matters commercially</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ValueCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Improves structured data quality"
              description="Converts free-text into reliable, structured clinical records."
            />
            <ValueCard
              icon={<Clock className="h-5 w-5" />}
              title="Reduces manual coding effort"
              description="Supports review workflows that reduce repetitive administrative work."
            />
            <ValueCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Safer AI-assisted clinical workflows"
              description="No automatic writes. Human review gates every step."
            />
            <ValueCard
              icon={<Globe className="h-5 w-5" />}
              title="Supports interoperability"
              description="FHIR R4 data supports analytics and downstream care coordination."
            />
            <ValueCard
              icon={<Activity className="h-5 w-5" />}
              title="Reporting and analytics ready"
              description="Structured data prepares for dashboards, audits, and population health."
            />
            <ValueCard
              icon={<Cpu className="h-5 w-5" />}
              title="Reusable architecture"
              description="A practical pattern for health-tech teams building on FHIR."
            />
          </div>
        </section>

        {/* 10. Recommended demo path */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-foreground">
            <LayoutList className="h-6 w-6 text-primary" />
            Recommended demo path
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Recommended screen recording flow:</p>
          <ol className="space-y-2">
            {[
              "Open Patient List",
              "Select Ezekiel Leslie Walter",
              "Show Conditions, Vitals, and Medications",
              "Open Clinical Notes",
              "Use Diabetes follow-up sample",
              "Extract candidate conditions",
              'Show "No chest pain" excluded as negated',
              "Show diabetes/type 2 diabetes specificity handling",
              "Generate FHIR Condition previews",
              "Approve Type 2 diabetes and hypertension",
              "Send approved items to SNOMED coding queue",
              "Open Terminology Search with prefilled term",
              "Show authentication-required handling",
              "Open Workflow Summary",
              "Show Ready for FHIR save = No until SNOMED coding, validation, and final sign-off are complete",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        {/* 11. Safety and governance */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Lock className="h-6 w-6 text-primary" />
            Safety and governance
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "Preview-only NLP workflow",
              "Clinician review required",
              "No automatic FHIR writes",
              "No fake terminology results",
              "Terminology credentials remain server-side",
              "Final sign-off gate before future save",
              "Audit package JSON available for review",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* 12. Call to action */}
        <section className="rounded-xl bg-primary p-8 text-center text-primary-foreground">
          <h2 className="text-2xl font-bold">Explore the prototype</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm opacity-90">
            Start with the Patient List, select a patient, and try the Clinical Notes extraction workflow.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-md bg-primary-foreground px-5 py-2.5 text-sm font-semibold text-primary shadow-sm hover:bg-primary-foreground/90"
            >
              Patient List
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/terminology"
              className="inline-flex items-center gap-2 rounded-md border border-primary-foreground/30 bg-transparent px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10"
            >
              Terminology Search
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function ForCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">{icon}</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ValueCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
