import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "./input";

afterEach(cleanup);

describe("Input", () => {
  it("[V6] accepts text through its associated label", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="customer-name">Your name</label>
        <Input id="customer-name" required placeholder="Full name" />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Your name" });
    await user.type(input, "Ayesha Khan");

    expect(input).toHaveValue("Ayesha Khan");
    expect(input).toBeRequired();
  });

  it("[V6] keeps a disabled field unavailable for editing", () => {
    render(
      <>
        <label htmlFor="locked-email">Email address</label>
        <Input
          id="locked-email"
          type="email"
          disabled
          value="a@example.com"
          readOnly
        />
      </>,
    );

    expect(
      screen.getByRole("textbox", { name: "Email address" }),
    ).toBeDisabled();
  });
});
