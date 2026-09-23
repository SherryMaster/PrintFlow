"use client";

import { useState } from "react";

import { InlineOutcome, UploadProgress } from "@/ui/patterns/feedback";
import { Button } from "@/ui/primitives/button";

export function UploadInterruptionExample() {
  const [interrupted, setInterrupted] = useState(false);

  return (
    <div className="grid gap-3">
      <UploadProgress
        filename="large-format-artwork.pdf"
        percent={27}
        interrupted={interrupted}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit"
        onClick={() => setInterrupted((current) => !current)}
      >
        {interrupted ? "Retry upload" : "Interrupt upload"}
      </Button>
      {interrupted && (
        <InlineOutcome kind="error" title="Upload interrupted">
          Retry the upload when your connection is stable.
        </InlineOutcome>
      )}
    </div>
  );
}
