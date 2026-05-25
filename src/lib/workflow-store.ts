import { useSyncExternalStore } from "react";

export interface WorkflowSnapshot {
  updatedAt: string;
  totalCandidates: number;
  contextCounts: {
    Present: number;
    Negated: number;
    Historical: number;
    "Family history": number;
    Uncertain: number;
  };
  included: number;
  excluded: number;
  reviewedCount: number;
  needsReviewCount: number;
  previewsGenerated: boolean;
  previewsCount: number;
  approvedForCoding: number;
  needsChanges: number;
  rejected: number;
  notReviewed: number;
  inCodingQueue: number;
  codingDeferred: number;
  codingRemoved: number;
  eligibleForSignOff: number;
  signedOff: number;
  needsSignOffReview: number;
  notSigned: number;
  hasOverlapWarnings: boolean;
  hasLowConfidence: boolean;
  hasNegatedExcluded: boolean;
  hasFamilyHistoryExcluded: boolean;
}

type Listener = () => void;

const store = new Map<string, WorkflowSnapshot>();
const listeners = new Set<Listener>();

export function publishWorkflowSnapshot(patientId: string, snap: WorkflowSnapshot) {
  store.set(patientId, snap);
  listeners.forEach((l) => l());
}

export function clearWorkflowSnapshot(patientId: string) {
  if (store.delete(patientId)) listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useWorkflowSnapshot(patientId: string): WorkflowSnapshot | undefined {
  return useSyncExternalStore(
    subscribe,
    () => store.get(patientId),
    () => undefined,
  );
}
