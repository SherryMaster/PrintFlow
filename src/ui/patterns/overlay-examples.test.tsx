import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { OverlayExamples } from "./overlay-examples";

afterEach(cleanup);

describe("OverlayExamples", () => {
  it("[V6] opens artwork guidance and order details with named dialogs", async () => {
    const user = userEvent.setup();
    render(<OverlayExamples />);

    await user.click(
      screen.getByRole("button", { name: "Artwork guidance dialog" }),
    );
    const guidance = await screen.findByRole("dialog", {
      name: "Artwork guidance",
    });
    expect(
      within(guidance).getByText(/upload a PDF at the final size/i),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Order details drawer" }),
    );
    const orderDetails = await screen.findByRole("dialog", {
      name: "Order details",
    });
    expect(orderDetails).toHaveTextContent("PF-2026-0042");
    expect(orderDetails).toHaveTextContent("artwork review");
  });
});
