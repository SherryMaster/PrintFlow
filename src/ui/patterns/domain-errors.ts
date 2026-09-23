import type { DomainErrorCode } from "@/db/contracts";

const messages: Record<DomainErrorCode, string> = {
  not_found: "We could not find that item. Check the link and try again.",
  forbidden: "You do not have access to this action.",
  stale_version:
    "This changed while you were working. Refresh and review the latest details.",
  invalid_transition: "This step is not available in the current state.",
  conflict:
    "This request conflicts with a recent change. Review the details and try again.",
  validation_failed:
    "Some details need attention. Check the highlighted fields.",
  expired: "This link or action has expired. Request a new one.",
  superseded: "A newer version is available. Review it before continuing.",
  quarantined: "This file is being checked and cannot be used yet.",
  erased: "This item is no longer available.",
  stale_lease: "The action timed out. Refresh before trying again.",
};

export function domainErrorMessage(code: DomainErrorCode): string {
  return messages[code];
}
