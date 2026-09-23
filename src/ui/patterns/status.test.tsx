import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge, StatusDetail } from "./status";
import { presentStatus } from "@/ui/status";

afterEach(cleanup);

describe("status patterns", () => {
  it("[V6] pairs status wording with explanation and the next action", () => {
    const status = presentStatus({
      label: "Needs a new file",
      tone: "warning",
      explanation: "The artwork is too small for the selected size.",
      nextAction: { label: "View artwork guidance", href: "#artwork-guidance" },
    });

    render(<StatusDetail status={status} />);

    expect(screen.getByText("Needs a new file")).toBeVisible();
    expect(
      screen.getByText("The artwork is too small for the selected size."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View artwork guidance" }),
    ).toHaveAttribute("href", "#artwork-guidance");
  });

  it("[V6] keeps a standalone status label readable", () => {
    render(
      <StatusBadge
        status={presentStatus({ label: "Review in progress", tone: "info" })}
      />,
    );

    expect(screen.getByText("Review in progress")).toBeVisible();
  });
});
