import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import logo from "@/assets/logo.png";
import {
  type FhirPatient,
  searchPatients,
  getPatient,
  createPatient,
  updatePatient,
} from "@/lib/fhir";
import { PatientList } from "@/components/clinical/PatientList";
import { PatientForm, type PatientFormValues } from "@/components/clinical/PatientForm";
import { SearchBar } from "@/components/clinical/SearchBar";
import { LoadingState, ErrorState, EmptyState } from "@/components/clinical/StateViews";

export const Route = createFileRoute("/")({
  component: PatientsPage,
});

function toResource(v: PatientFormValues, id?: string): FhirPatient {
  return {
    resourceType: "Patient",
    ...(id ? { id } : {}),
    name: [{ given: v.given.split(/\s+/).filter(Boolean), family: v.family }],
    gender: v.gender,
    birthDate: v.birthDate,
  };
}

function PatientsPage() {
  const [patients, setPatients] = useState<FhirPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FhirPatient | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useMemo(
    () => async (term: string) => {
      setLoading(true);
      setError(null);
      try {
        setPatients(await searchPatients(term));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load patients");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(debounced);
  }, [debounced, load]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = async (id: string) => {
    setFormError(null);
    setFormOpen(true);
    setEditing(null);
    try {
      const p = await getPatient(id);
      setEditing(p);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to load patient");
    }
  };

  const handleSubmit = async (v: PatientFormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editing?.id) {
        await updatePatient(editing.id, toResource(v, editing.id));
      } else {
        await createPatient(toResource(v));
      }
      setFormOpen(false);
      setEditing(null);
      await load(debounced);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save patient");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Patient Management" className="h-7 w-7" />
            <h1 className="text-lg font-semibold text-foreground">Patient Management</h1>
          </div>
          <span className="text-xs text-muted-foreground">FHIR R4</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-96">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New patient
          </button>
        </div>

        {loading ? (
          <LoadingState label="Loading patients..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(debounced)} />
        ) : patients.length === 0 ? (
          <EmptyState
            title={debounced ? "No patients match your search" : "No patients yet"}
            hint={debounced ? "Try a different name." : "Create your first patient to get started."}
          />
        ) : (
          <PatientList patients={patients} onEdit={openEdit} />
        )}
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {editing ? "Edit patient" : "New patient"}
              </h2>
              <button
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              {formError && (
                <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {formError}
                </div>
              )}
              <PatientForm
                initial={editing}
                submitLabel={editing ? "Update patient" : "Create patient"}
                submitting={submitting}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setFormOpen(false);
                  setEditing(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
