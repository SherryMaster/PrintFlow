import { roundToNearestRupee } from "@/db/contracts";
export { parseEventPayload, type EventType } from "@/jobs/events";

export const jobWorkflowStates = [
  "received",
  "under_review",
  "ready_for_production",
  "in_production",
  "ready",
  "canceled",
] as const;

export type JobWorkflowState = (typeof jobWorkflowStates)[number];

const normalWorkflowStates = jobWorkflowStates.filter(
  (state) => state !== "canceled",
);

export function canTransitionJob(
  from: JobWorkflowState,
  to: JobWorkflowState,
  hasReason: boolean,
): boolean {
  if (from === "canceled" || from === to) {
    return false;
  }

  if (to === "canceled") {
    return hasReason;
  }

  const fromIndex = normalWorkflowStates.indexOf(from);
  const toIndex = normalWorkflowStates.indexOf(to);
  const movingForward = toIndex === fromIndex + 1;
  const adjacentReversal = toIndex === fromIndex - 1 && hasReason;

  return movingForward || adjacentReversal;
}

export function deriveOrderProgress(
  states: readonly JobWorkflowState[],
): JobWorkflowState | "canceled" {
  const active = states.filter((state) => state !== "canceled");

  if (active.length === 0) {
    return "canceled";
  }

  return active.reduce((least, state) =>
    normalWorkflowStates.indexOf(state) < normalWorkflowStates.indexOf(least)
      ? state
      : least,
  );
}

export function isOrderReady(
  states: readonly JobWorkflowState[],
  unresolvedBlockers: number,
): boolean {
  const active = states.filter((state) => state !== "canceled");
  return (
    active.length > 0 &&
    active.every((state) => state === "ready") &&
    unresolvedBlockers === 0
  );
}

export type QuoteJob = {
  jobRevisionId: string;
  lineNumber: number;
  subtotal: bigint;
  tax: bigint;
};

export type QuoteJobTotal = QuoteJob & {
  allocatedAdjustment: bigint;
  roundedTotal: bigint;
};

export function hasExactQuoteCoverage(
  requiredRevisionIds: readonly string[],
  suppliedRevisionIds: readonly string[],
): boolean {
  if (
    new Set(requiredRevisionIds).size !== requiredRevisionIds.length ||
    new Set(suppliedRevisionIds).size !== suppliedRevisionIds.length
  ) {
    return false;
  }

  const required = new Set(requiredRevisionIds);
  return (
    required.size === suppliedRevisionIds.length &&
    suppliedRevisionIds.every((id) => required.has(id))
  );
}

export function withoutBlocker(
  projection: { schema_version?: unknown; blockers?: unknown },
  resolved: string,
) {
  const blockers = Array.isArray(projection.blockers)
    ? projection.blockers.filter(
        (blocker): blocker is string =>
          typeof blocker === "string" && blocker !== resolved,
      )
    : [];

  return {
    schema_version: "blocker_projection.v1",
    blockers,
  } as const;
}

export function withBlocker(
  projection: { schema_version?: unknown; blockers?: unknown },
  required: string,
) {
  const blockers = Array.isArray(projection.blockers)
    ? projection.blockers.filter(
        (blocker): blocker is string => typeof blocker === "string",
      )
    : [];

  return {
    schema_version: "blocker_projection.v1",
    blockers: blockers.includes(required) ? blockers : [...blockers, required],
  } as const;
}

export function deriveJobBlockers(
  requirements: { [key: string]: unknown },
  pricingMode: "standard" | "quote_required",
  options: { standardPriceAccepted?: boolean } = {},
): string[] {
  const requiredArtworkPurposes = Array.isArray(
    requirements.required_artwork_purposes,
  )
    ? requirements.required_artwork_purposes.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  return [
    ...(pricingMode === "quote_required"
      ? ["quote_response"]
      : options.standardPriceAccepted
        ? []
        : ["price_acceptance"]),
    ...(requiredArtworkPurposes.length > 0 ? ["artwork_review"] : []),
    ...(requirements.proof_approval_required === true
      ? ["proof_approval"]
      : []),
  ];
}

function distributeRemainder(
  jobs: readonly QuoteJob[],
  remainder: bigint,
  allocations: Map<string, bigint>,
) {
  const step = remainder < 0n ? -1n : 1n;
  let units = remainder < 0n ? -remainder : remainder;
  const ordered = [...jobs].sort(
    (left, right) => left.lineNumber - right.lineNumber,
  );
  let index = 0;

  while (units > 0n) {
    const job = ordered[index % ordered.length];
    allocations.set(
      job.jobRevisionId,
      (allocations.get(job.jobRevisionId) ?? 0n) + step,
    );
    units -= 1n;
    index += 1;
  }
}

export function allocateQuoteAdjustment(
  jobs: readonly QuoteJob[],
  adjustment: bigint,
): QuoteJobTotal[] {
  if (jobs.length === 0) {
    throw new Error("A quote must cover at least one job");
  }

  if (jobs.some((job) => job.subtotal < 0n || job.tax < 0n)) {
    throw new Error("Quote subtotal and tax values cannot be negative");
  }

  const totalSubtotal = jobs.reduce((sum, job) => sum + job.subtotal, 0n);
  const allocations = new Map<string, bigint>();
  let allocated = 0n;

  for (const job of jobs) {
    const value =
      totalSubtotal === 0n
        ? adjustment / BigInt(jobs.length)
        : (adjustment * job.subtotal) / totalSubtotal;
    allocations.set(job.jobRevisionId, value);
    allocated += value;
  }

  distributeRemainder(jobs, adjustment - allocated, allocations);

  return jobs
    .map((job) => {
      const allocatedAdjustment = allocations.get(job.jobRevisionId) ?? 0n;
      return {
        ...job,
        allocatedAdjustment,
        roundedTotal: roundToNearestRupee(
          job.subtotal + allocatedAdjustment + job.tax,
        ),
      };
    })
    .sort((left, right) => left.lineNumber - right.lineNumber);
}

export const blockerTypes = {
  price_acceptance: { exceptionAllowed: false },
  quote_response: { exceptionAllowed: false },
  artwork_review: { exceptionAllowed: false },
  proof_approval: { exceptionAllowed: true },
  file_validation: { exceptionAllowed: false },
  file_scan: { exceptionAllowed: false },
  production_hold: { exceptionAllowed: false },
} as const;
