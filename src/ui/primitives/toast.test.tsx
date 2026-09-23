import { cleanup, act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createToastManager, Toaster } from "./toast";

afterEach(cleanup);

describe("Toaster", () => {
  it("[V6] announces a saved result and lets the customer dismiss it", async () => {
    const user = userEvent.setup();
    const manager = createToastManager();
    render(<Toaster toastManager={manager} />);

    await act(async () => {
      manager.add({
        title: "Details saved",
        description: "Your order information is up to date.",
        type: "success",
      });
    });
    expect(await screen.findByText("Details saved")).toBeVisible();
    expect(
      screen.getByText("Your order information is up to date."),
    ).toBeVisible();
    await user.tab();
    await user.tab();
    const close = screen.getByRole("button", { name: "Close toast" });
    await user.click(close);
    expect(screen.queryByText("Details saved")).not.toBeInTheDocument();
  });
});
