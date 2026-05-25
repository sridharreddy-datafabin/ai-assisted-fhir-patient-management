import { Pencil } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { type FhirPatient, formatPatientName } from "@/lib/fhir";

function GenderBadge({ gender }: { gender?: string }) {
  const g = (gender ?? "").toLowerCase();
  if (g === "female") {
    return (
      <span className="inline-flex items-center rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
        Female
      </span>
    );
  }
  if (g === "male") {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
        Male
      </span>
    );
  }
  return (
    <span className="text-muted-foreground capitalize">
      {gender ?? "—"}
    </span>
  );
}

export function PatientList({
  patients,
  onEdit,
}: {
  patients: FhirPatient[];
  onEdit: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3.5 font-bold">Name</th>
            <th className="px-4 py-3.5 font-bold">Gender</th>
            <th className="px-4 py-3.5 font-bold">Date of birth</th>
            <th className="px-4 py-3.5 font-bold">FHIR ID</th>
            <th className="px-4 py-3.5 text-right font-bold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {patients.map((p) => (
            <tr key={p.id} className="cursor-pointer transition-colors hover:bg-muted/40">
              <td className="px-4 py-3.5 font-medium text-foreground">
                {p.id ? (
                  <Link
                    to="/patient/$id"
                    params={{ id: p.id }}
                    className="hover:underline"
                  >
                    {formatPatientName(p)}
                  </Link>
                ) : (
                  formatPatientName(p)
                )}
              </td>
              <td className="px-4 py-3.5"><GenderBadge gender={p.gender} /></td>
              <td className="px-4 py-3.5 text-muted-foreground">{p.birthDate ?? "—"}</td>
              <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{p.id}</td>
              <td className="px-4 py-3.5 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    p.id && onEdit(p.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
