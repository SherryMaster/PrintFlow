import { and, asc, eq } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  jobRevisions,
  jobs,
  orders,
  quoteLines,
  quoteRevisions,
  quoteThreads,
} from "@/db/schema";
import {
  deriveOrderProgress,
  isOrderReady,
  type JobWorkflowState,
} from "@/modules/orders/model";
import type { OrderAuthority } from "@/modules/orders/authorization";

export async function getOrderAggregate(input: {
  authority: OrderAuthority;
  orderId?: string;
  reference?: string;
}) {
  if (input.authority.kind === "guest") {
    if (
      input.reference ||
      (input.orderId && input.orderId !== input.authority.orderId) ||
      !input.authority.scopes.includes("order:read")
    ) {
      throw new Error("not_found");
    }
  } else if ((input.orderId ? 1 : 0) + (input.reference ? 1 : 0) !== 1) {
    throw new Error("Provide exactly one order identifier");
  }

  const shopId = input.authority.shopId;
  const orderId =
    input.authority.kind === "guest" ? input.authority.orderId : input.orderId;

  const { db } = getDatabase();
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.shopId, shopId),
      orderId ? eq(orders.id, orderId) : eq(orders.reference, input.reference!),
    ),
  });

  if (!order) {
    throw new Error("not_found");
  }

  const rows = await db
    .select({
      id: jobs.id,
      lineNumber: jobs.lineNumber,
      workflowState: jobs.workflowState,
      blockers: jobs.blockerProjection,
      productionHold: jobs.productionHold,
      revisionId: jobRevisions.id,
      configuration: jobRevisions.configuration,
      pricingMode: jobRevisions.pricingMode,
      roundedTotal: jobRevisions.roundedTotal,
    })
    .from(jobs)
    .innerJoin(
      jobRevisions,
      and(
        eq(jobRevisions.shopId, jobs.shopId),
        eq(jobRevisions.id, jobs.currentRevisionId),
      ),
    )
    .where(and(eq(jobs.shopId, shopId), eq(jobs.orderId, order.id)))
    .orderBy(asc(jobs.lineNumber))
    .limit(20);

  const acceptedQuoteLines = await db
    .select({
      jobRevisionId: quoteLines.jobRevisionId,
      roundedTotal: quoteLines.roundedTotal,
    })
    .from(quoteThreads)
    .innerJoin(
      quoteRevisions,
      and(
        eq(quoteRevisions.shopId, quoteThreads.shopId),
        eq(quoteRevisions.id, quoteThreads.currentRevisionId),
        eq(quoteRevisions.lifecycle, "accepted"),
      ),
    )
    .innerJoin(
      quoteLines,
      and(
        eq(quoteLines.shopId, quoteRevisions.shopId),
        eq(quoteLines.quoteRevisionId, quoteRevisions.id),
      ),
    )
    .where(
      and(eq(quoteThreads.shopId, shopId), eq(quoteThreads.orderId, order.id)),
    )
    .limit(20);
  const acceptedQuoteTotals = new Map<string, bigint>();
  for (const line of acceptedQuoteLines) {
    acceptedQuoteTotals.set(
      line.jobRevisionId,
      (acceptedQuoteTotals.get(line.jobRevisionId) ?? 0n) + line.roundedTotal,
    );
  }

  const activeRows = rows.filter((row) => row.workflowState !== "canceled");
  const amountFor = (row: (typeof rows)[number]) =>
    row.pricingMode === "quote_required"
      ? acceptedQuoteTotals.get(row.revisionId)
      : row.roundedTotal;

  const unknownPriceJobIds = activeRows
    .filter((row) => amountFor(row) == null)
    .map((row) => row.id);
  const knownTotal = activeRows.reduce(
    (sum, row) => sum + (amountFor(row) ?? 0n),
    0n,
  );
  const states = rows.map((row) => row.workflowState as JobWorkflowState);
  const blockerCount = activeRows.reduce((count, row) => {
    const blockers = Array.isArray(row.blockers.blockers)
      ? row.blockers.blockers.length
      : 0;
    return count + blockers + (row.productionHold ? 1 : 0);
  }, 0);

  const shared = {
    id: order.id,
    reference: order.reference,
    source: order.source,
    progress: deriveOrderProgress(states),
    readyForCollection: isOrderReady(states, blockerCount),
    knownTotalPaisa: knownTotal.toString(10),
    unknownPriceJobIds,
    requestedLocalDate: order.requestedLocalDate,
    confirmedDueAt: order.confirmedDueAt,
    jobs: rows.map((row) => ({
      id: row.id,
      lineNumber: row.lineNumber,
      workflowState: row.workflowState,
      blockers: row.blockers,
      configuration: row.configuration,
      pricingMode: row.pricingMode,
      roundedTotalPaisa: amountFor(row)?.toString(10),
    })),
  };

  if (input.authority.kind === "guest") {
    return {
      ...shared,
      contact: {
        name: order.contactName,
        phone: order.contactPhoneDisplay,
        email: order.contactEmailDisplay,
      },
    };
  }

  return {
    ...shared,
    contact: {
      name: order.contactName,
      phone: order.contactPhoneDisplay,
      phoneSearch: order.contactPhoneSearch,
      email: order.contactEmailDisplay,
      emailSearch: order.contactEmailSearch,
    },
    version: order.version,
    terminalState: order.terminalState,
  };
}
