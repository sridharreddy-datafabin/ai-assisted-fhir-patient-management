import { useState } from "react";
import { Activity, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface TestResult {
  status: number;
  ok: boolean;
  requestPath: string;
  resourceType?: string;
  softwareName?: string;
  fhirVersion?: string;
  error?: string;
  errorBody?: string;
  summaryMessage: string;
}

export function TerminologyDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    const requestPath = "/api/terminology/metadata";
    try {
      const res = await fetch(requestPath, {
        headers: { Accept: "application/fhir+json" },
      });
      let body: Record<string, unknown> = {};
      try {
        body = await res.json();
      } catch {
        body = {};
      }

      const resourceType = body.resourceType as string | undefined;
      const softwareName = (body.software as { name?: string } | undefined)?.name;
      const fhirVersion = body.fhirVersion as string | undefined;

      let summaryMessage: string;
      if (res.status === 401) {
        summaryMessage = "Proxy route works, but upstream OntoServer returned 401 Unauthorized";
      } else if (res.ok && resourceType === "CapabilityStatement") {
        summaryMessage = "Proxy route works and returned CapabilityStatement";
      } else if (!res.ok || res.status === 0) {
        summaryMessage = "Proxy route failed";
      } else {
        summaryMessage = "Proxy route works, but unexpected response from upstream";
      }

      const proxyErrorIndicators = [
        "Terminology service unavailable",
        "Network failure contacting terminology server",
        "Non-JSON response from terminology server",
      ];
      const isProxyError = proxyErrorIndicators.some((indicator) =>
        (body.error as string)?.includes(indicator),
      );
      if (isProxyError) {
        summaryMessage = "Proxy route failed";
      }

      setResult({
        status: res.status,
        ok: res.ok,
        requestPath,
        resourceType,
        softwareName,
        fhirVersion,
        error: !res.ok ? (body.error as string) ?? `HTTP ${res.status}` : undefined,
        errorBody: !res.ok ? JSON.stringify(body, null, 2) : undefined,
        summaryMessage,
      });
    } catch (e) {
      setResult({
        status: 0,
        ok: false,
        requestPath,
        error: e instanceof Error ? e.message : "Request failed",
        summaryMessage: "Proxy route failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Developer diagnostics</h2>
          <p className="text-xs text-muted-foreground">
            Verify the OntoServer terminology proxy.
          </p>
        </div>
        <button
          onClick={runTest}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Activity className="h-3.5 w-3.5" />
          {loading ? "Testing..." : "Test OntoServer Proxy"}
        </button>
      </div>

      {result && (
        <div className="rounded-md border border-border bg-card p-3 text-xs">
          <div className="mb-2 flex items-center gap-2 font-medium">
            {result.ok ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : result.status === 401 ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-foreground">{result.summaryMessage}</span>
          </div>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-muted-foreground">
            <dt>Request path</dt>
            <dd className="font-mono text-foreground">{result.requestPath}</dd>
            <dt>HTTP status</dt>
            <dd className="font-mono text-foreground">{result.status || "—"}</dd>
            <dt>resourceType</dt>
            <dd className="font-mono text-foreground">{result.resourceType ?? "—"}</dd>
            <dt>Software name</dt>
            <dd className="text-foreground">{result.softwareName ?? "—"}</dd>
            <dt>FHIR version</dt>
            <dd className="font-mono text-foreground">{result.fhirVersion ?? "—"}</dd>
            {result.error && (
              <>
                <dt>Error</dt>
                <dd className="text-destructive">{result.error}</dd>
              </>
            )}
            {result.errorBody && (
              <>
                <dt>Error body</dt>
                <dd className="text-destructive">
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
                    {result.errorBody}
                  </pre>
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </section>
  );
}

