import { useState, useEffect, FormEvent } from "react";
import type { FhirPatient, Gender } from "@/lib/fhir";

export interface PatientFormValues {
  given: string;
  family: string;
  gender: Gender;
  birthDate: string;
}

export function PatientForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: FhirPatient | null;
  submitLabel: string;
  onSubmit: (values: PatientFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const [given, setGiven] = useState("");
  const [family, setFamily] = useState("");
  const [gender, setGender] = useState<Gender>("unknown");
  const [birthDate, setBirthDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initial) {
      setGiven(initial.name?.[0]?.given?.join(" ") ?? "");
      setFamily(initial.name?.[0]?.family ?? "");
      setGender((initial.gender as Gender) ?? "unknown");
      setBirthDate(initial.birthDate ?? "");
    } else {
      setGiven("");
      setFamily("");
      setGender("unknown");
      setBirthDate("");
    }
    setErrors({});
  }, [initial]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!given.trim()) e.given = "Given name is required";
    if (!family.trim()) e.family = "Family name is required";
    if (!birthDate) e.birthDate = "Date of birth is required";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) e.birthDate = "Invalid date";
    else if (new Date(birthDate) > new Date()) e.birthDate = "Cannot be in the future";
    if (!["male", "female", "other", "unknown"].includes(gender)) e.gender = "Invalid gender";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handle = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    await onSubmit({ given: given.trim(), family: family.trim(), gender, birthDate });
  };

  const field = "block text-xs font-medium text-muted-foreground mb-1";
  const input =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={field}>Given name</label>
          <input className={input} value={given} onChange={(e) => setGiven(e.target.value)} />
          {errors.given && <p className="mt-1 text-xs text-destructive">{errors.given}</p>}
        </div>
        <div>
          <label className={field}>Family name</label>
          <input className={input} value={family} onChange={(e) => setFamily(e.target.value)} />
          {errors.family && <p className="mt-1 text-xs text-destructive">{errors.family}</p>}
        </div>
        <div>
          <label className={field}>Gender</label>
          <select
            className={input}
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender)}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label className={field}>Date of birth</label>
          <input
            type="date"
            className={input}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          {errors.birthDate && <p className="mt-1 text-xs text-destructive">{errors.birthDate}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
