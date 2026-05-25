import { useQuery } from "@tanstack/react-query";
import { getConditions, codeDisplay } from "@/lib/fhir";
import { LoadingState, ErrorState, EmptyState } from "./StateViews";

export function ConditionsTab({ patientId }: { patientId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["conditions", patientId],
    queryFn: () => getConditions(patientId),
  });

  if (isLoading) return <LoadingState label="Loading conditions..." />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load conditions"}
        onRetry={() => refetch()}
      />
    );
  if (!data || data.length === 0)
    return <EmptyState title="No conditions" hint="This patient has no recorded conditions." />;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-bold">Condition</th>
            <th className="px-4 py-3 font-bold">Code</th>
            <th className="px-4 py-3 font-bold">Clinical status</th>
            <th className="px-4 py-3 font-bold">Verification</th>
            <th className="px-4 py-3 font-bold">Onset</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((c) => (
            <tr key={c.id} className="hover:bg-muted/40">
              <td className="px-4 py-3 font-medium text-foreground">{codeDisplay(c.code)}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {c.code?.coding?.[0]?.code ?? "—"}
              </td>
              <td className="px-4 py-3 capitalize text-muted-foreground">
                {codeDisplay(c.clinicalStatus)}
              </td>
              <td className="px-4 py-3 capitalize text-muted-foreground">
                {codeDisplay(c.verificationStatus)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {c.onsetDateTime?.slice(0, 10) ?? c.recordedDate?.slice(0, 10) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
