import { useState } from "react";
import { useWorkflowSnapshot } from "@/lib/workflow-store";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  Link2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

interface Props {
  patientId: string;
  onOpenWorkflow: () => void;
}

export function EncountersTab({ patientId, onOpenWorkflow }: Props) {
  const live = useWorkflowSnapshot(patientId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Encounters</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              FHIR Encounter data will support visit history, care setting context, and longitudinal patient review.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenWorkflow}>
            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
            Open Workflow Summary
          </Button>
        </div>
      </section>

      {/* Three cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          icon={<FileText className="h-5 w-5 text-primary" />}
          title="Planned FHIR resource"
          lines={[
            { label: "Resource", value: "Encounter" },
            {
              label: "Purpose",
              value:
                "Track patient visits, consultations, admissions, and care episodes",
            },
          ]}
        />
        <Card
          icon={<Link2 className="h-5 w-5 text-primary" />}
          title="Why it matters"
          bullets={[
            "Links clinical notes, conditions, medications, and observations to a care episode",
            "Supports audit trail and longitudinal review",
            "Helps clinicians understand when and where a problem was recorded",
          ]}
        />
        <Card
          icon={<ShieldCheck className="h-5 w-5 text-primary" />}
          title="Prototype status"
          bullets={[
            "Not connected in this challenge build",
            "Ready to extend using GET /Encounter?patient=[id]",
            "No encounter data is written or modified",
          ]}
        />
      </div>

      {/* Future workflow list */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Future Encounter workflow
        </h3>
        <ol className="space-y-2">
          {[
            "Fetch patient encounters from FHIR",
            "Link clinical notes and extracted conditions to an encounter",
            "Show encounter timeline",
            "Support encounter-specific coding review",
            "Preserve audit context for future Condition creation",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-sm text-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Note */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Encounter functionality is intentionally read-only/planned in this prototype. Core challenge workflow focuses on patient data, conditions, terminology readiness, NLP extraction, and clinical sign-off.
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  lines,
  bullets,
}: {
  icon: React.ReactNode;
  title: string;
  lines?: Array<{ label: string; value: string }>;
  bullets?: string[];
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      {lines && (
        <dl className="mt-3 space-y-2 text-xs">
          {lines.map((l) => (
            <div key={l.label}>
              <dt className="text-muted-foreground">{l.label}</dt>
              <dd className="mt-0.5 font-medium text-foreground">{l.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {bullets && (
        <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-foreground">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
