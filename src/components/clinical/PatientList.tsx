import { Pencil } from "lucide-react";
import { type FhirPatient, formatPatientName } from "@/lib/fhir";

export function PatientList({
  patients,
  onEdit,
}: {
  patients: FhirPatient[];
  onEdit: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Gender</th>
            <th className="px-4 py-3 font-medium">Date of birth</th>
            <th className="px-4 py-3 font-medium">FHIR ID</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {patients.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium text-foreground">{formatPatientName(p)}</td>
              <td className="px-4 py-3 capitalize text-muted-foreground">{p.gender ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.birthDate ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => p.id && onEdit(p.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
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
