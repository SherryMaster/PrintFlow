import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Textarea } from "./textarea";

afterEach(cleanup);

describe("Textarea", () => {
  it("[V6] accepts a multi line order note through its label", async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="production-note">Production note</label>
        <Textarea id="production-note" />
      </>,
    );

    const textarea = screen.getByRole("textbox", { name: "Production note" });
    await user.type(textarea, "Print on both sides.{Enter}Trim to A4.");

    expect(textarea).toHaveValue("Print on both sides.\nTrim to A4.");
  });
});
