export type OperationalSignalName =
  | "command_failure"
  | "stale_version"
  | "invalid_transition"
  | "guest_grant_failure"
  | "quarantined_file"
  | "outbox_lag"
  | "outbox_lease_recovered"
  | "outbox_dead";

export type OperationalSignal = {
  name: OperationalSignalName;
  occurredAt: string;
  operation: string;
  correlationId?: string;
  shopId?: string;
  orderId?: string;
  jobId?: string;
  eventId?: string;
  value?: number;
};

export type OperationalSignalSink = (signal: OperationalSignal) => void;

const jsonLogSink: OperationalSignalSink = (signal) => {
  console.info(JSON.stringify({ kind: "printflow.operational", ...signal }));
};

let signalSink: OperationalSignalSink = jsonLogSink;

export function recordOperationalSignal(
  signal: Omit<OperationalSignal, "occurredAt"> & { occurredAt?: string },
): void {
  signalSink({
    ...signal,
    occurredAt: signal.occurredAt ?? new Date().toISOString(),
  });
}

export function setOperationalSignalSinkForTests(
  sink: OperationalSignalSink,
): () => void {
  const previous = signalSink;
  signalSink = sink;
  return () => {
    signalSink = previous;
  };
}
