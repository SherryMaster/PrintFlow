import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDatabase } from "@/db/client";
import {
  catalogVersionEvents,
  priceRuleVersions,
  serviceVersions,
  services,
  shopActivityEntries,
} from "@/db/schema";
import {
  priceRuleSchema,
  serviceDefinitionSchema,
} from "@/modules/orders/validation";

export async function publishCatalogVersion(input: {
  shopId: string;
  serviceId: string;
  serviceVersionId: string;
  priceRuleVersionId: string;
  actorSnapshotId: string;
  serviceDefinition: unknown;
  priceRules: unknown;
}) {
  const definition = serviceDefinitionSchema.parse(input.serviceDefinition);
  const rules = priceRuleSchema.parse(input.priceRules);
  const { db } = getDatabase();

  return db.transaction(async (transaction) => {
    const service = await transaction.query.services.findFirst({
      where: and(
        eq(services.shopId, input.shopId),
        eq(services.id, input.serviceId),
      ),
    });

    if (!service || !service.active) {
      throw new Error("not_found");
    }

    const publishedAt = new Date();
    const updatedServices = await transaction
      .update(serviceVersions)
      .set({ lifecycle: "published", definition, publishedAt })
      .where(
        and(
          eq(serviceVersions.shopId, input.shopId),
          eq(serviceVersions.id, input.serviceVersionId),
          eq(serviceVersions.serviceId, input.serviceId),
          eq(serviceVersions.lifecycle, "draft"),
        ),
      )
      .returning({ id: serviceVersions.id });
    const updatedRules = await transaction
      .update(priceRuleVersions)
      .set({ lifecycle: "published", rules, publishedAt })
      .where(
        and(
          eq(priceRuleVersions.shopId, input.shopId),
          eq(priceRuleVersions.id, input.priceRuleVersionId),
          eq(priceRuleVersions.serviceId, input.serviceId),
          eq(priceRuleVersions.lifecycle, "draft"),
        ),
      )
      .returning({ id: priceRuleVersions.id });

    if (updatedServices.length !== 1 || updatedRules.length !== 1) {
      throw new Error("invalid_transition");
    }

    await transaction.insert(catalogVersionEvents).values([
      {
        shopId: input.shopId,
        targetType: "service_version",
        targetId: input.serviceVersionId,
        eventType: "published",
        actorSnapshotId: input.actorSnapshotId,
        occurredAt: publishedAt,
      },
      {
        shopId: input.shopId,
        targetType: "price_rule_version",
        targetId: input.priceRuleVersionId,
        eventType: "published",
        actorSnapshotId: input.actorSnapshotId,
        occurredAt: publishedAt,
      },
    ]);
    await transaction.insert(shopActivityEntries).values({
      shopId: input.shopId,
      actionType: "catalog.version_published",
      actorSnapshotId: input.actorSnapshotId,
      serviceId: input.serviceId,
      details: {
        schema_version: "shop_activity.v1",
        service_version_id: input.serviceVersionId,
        price_rule_version_id: input.priceRuleVersionId,
      },
      correlationId: randomUUID(),
    });

    return { publishedAt };
  });
}
