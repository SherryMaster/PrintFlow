import { describe, expect, it } from "vitest";
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock3,
  LoaderCircle,
} from "lucide-react";

import { loadingStatus, presentStatus } from "./index";

describe("status presentation", () => {
  it.each([
    ["neutral", CircleHelp],
    ["info", Clock3],
    ["warning", CircleAlert],
    ["success", CircleCheck],
    ["danger", CircleAlert],
  ] as const)("[V6] gives %s status its matching icon", (tone, icon) => {
    expect(presentStatus({ label: "Needs review", tone }).icon).toBe(icon);
  });

  it("[V6] preserves status guidance and uses a loading icon", () => {
    expect(
      presentStatus({
        label: "Ready for pickup",
        tone: "success",
        explanation: "The order is complete.",
        nextAction: { label: "View order", href: "/orders/123" },
      }),
    ).toMatchObject({
      label: "Ready for pickup",
      tone: "success",
      explanation: "The order is complete.",
      nextAction: { label: "View order", href: "/orders/123" },
      icon: CircleCheck,
    });
    expect(loadingStatus).toMatchObject({ tone: "info", icon: LoaderCircle });
  });
});
