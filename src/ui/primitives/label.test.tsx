import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Label } from "./label";

afterEach(cleanup);

describe("Label", () => {
  it("[V6] focuses the input named by its label", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="order-reference">Order reference</Label>
        <input id="order-reference" />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Order reference" });
    await user.click(screen.getByText("Order reference"));

    expect(input).toHaveFocus();
  });
});
