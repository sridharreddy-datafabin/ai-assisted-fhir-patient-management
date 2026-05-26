# AI-Assisted Interoperable Patient Management

A FHIR-native patient management prototype that demonstrates how structured FHIR data, terminology workflows, and AI-assisted clinical note review can work together safely.

Built for the FHIR App Challenge.

## Live App

https://datafabin-patient-core.lovable.app

## Demo Video

https://youtu.be/CzC0hmhlidg

## Problem

Healthcare teams often work with fragmented patient records, unstructured clinical notes, inconsistent condition coding, and limited terminology validation. This creates manual review effort and reduces the quality of structured healthcare data for care coordination, reporting, analytics, and interoperability.

## Solution

This app demonstrates a safe, clinician-in-the-loop workflow that:

- Loads patient data from a FHIR R4 backend
- Displays patient demographics, conditions, vitals, and medications
- Extracts candidate conditions from clinical notes
- Detects negation, family history, historical context, uncertainty, and specificity issues
- Generates preview-only FHIR Condition resources
- Supports clinician approval before coding
- Hands approved candidates into a SNOMED coding workflow
- Provides terminology search, validation, and mapping preparation
- Tracks workflow readiness through a patient-level workflow summary
- Prevents unsafe automatic FHIR writes

## Key Features

### FHIR Patient Management

- Patient list
- Patient summary
- Conditions tab
- Vitals tab
- Medications tab
- Clinical Notes tab
- Workflow Summary tab

### NLP Extraction Workflow

- Extracts candidate clinical concepts from free-text notes
- Handles negated terms such as “no chest pain”
- Detects family history and historical context
- Flags duplicate and less-specific candidates
- Supports clinician review and approval

### FHIR Condition Preview

- Generates preview-only FHIR R4 Condition JSON
- Uses safe placeholder coding until SNOMED coding is complete
- Requires clinician approval before any future save workflow

### Terminology Workflow

- Secure backend terminology proxy pattern
- SNOMED concept search UI
- SNOMED validation framework
- Add coded condition workflow
- Mapping preparation for future ConceptMap / `$translate`
- Authentication-required state handled safely

### Governance and Safety

- No automatic FHIR writes
- No fake SNOMED results
- No browser-exposed terminology credentials
- Session-only workflow state
- Final clinical sign-off framework
- Final audit package JSON available for review

## Current Prototype Limitation

NHS Terminology Server system-to-system credentials have been requested but were not available before submission. The app is already wired for secure terminology access through `/api/terminology`, but live SNOMED search, validation, and mapping remain authentication-gated.

This limitation is handled intentionally:

- No credentials are exposed in the browser
- No fake SNOMED results are shown
- No FHIR Condition is saved without coding, validation, and sign-off
- Terminology functionality will activate once server-side credentials are configured

## Demo Workflow

Recommended flow for review:

1. Open the Business Case page
2. Review the problem, solution, and commercial value
3. Open the Patient Management page
4. Select a patient
5. Review demographics, conditions, vitals, and medications
6. Open Clinical Notes
7. Use the sample diabetes follow-up note
8. Extract candidate clinical concepts
9. Review negation, context, and duplicate/specificity handling
10. Generate FHIR Condition previews
11. Approve clinically relevant candidates
12. Send approved items to the SNOMED coding handoff
13. Open Terminology Search with a prefilled term
14. Review the authentication-required terminology state
15. Open Workflow Summary
16. Confirm readiness status and blocked FHIR save state

## Example Clinical Note

```text
Patient attended for diabetes follow-up. Type 2 diabetes remains poorly controlled. Patient also has hypertension. No chest pain reported. Medication review completed.
