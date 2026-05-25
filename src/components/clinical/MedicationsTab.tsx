import { useQuery } from "@tanstack/react-query";
import { getMedications, medicationName } from "@/lib/fhir";
import { LoadingState, ErrorState, EmptyState } from "./StateViews";

export function MedicationsTab({ patientId }: { patientId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["medications", patientId],
    queryFn: () => getMedications(patientId),
  });

  if (isLoading) return <LoadingState label="Loading medications..." />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load medications"}
        onRetry={() => refetch()}
      />
    );
  if (!data || data.length === 0)
    return <EmptyState title="No medications" hint="No medication requests on file." />;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-bold">Medication</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold">Intent</th>
            <th className="px-4 py-3 font-bold">Authored</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((m) => (
            <tr key={m.id} className="hover:bg-muted/40">
              <td className="px-4 py-3 font-medium text-foreground">{medicationName(m)}</td>
              <td className="px-4 py-3 capitalize text-muted-foreground">{m.status ?? "—"}</td>
              <td className="px-4 py-3 capitalize text-muted-foreground">{m.intent ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {m.authoredOn?.slice(0, 10) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
