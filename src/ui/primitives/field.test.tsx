import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Field, FieldError, FieldLabel, FieldSet, FieldLegend } from "./field";
import { Input } from "./input";

afterEach(cleanup);

describe("Field", () => {
  it("[V6] connects a label to its field and lists unique errors", () => {
    render(
      <FieldSet>
        <FieldLegend>Contact details</FieldLegend>
        <Field>
          <FieldLabel htmlFor="phone">Phone number</FieldLabel>
          <Input id="phone" aria-describedby="phone-help phone-error" />
          <p id="phone-help">Use a number the shop can call.</p>
          <FieldError
            id="phone-error"
            errors={[
              { message: "Enter a valid phone number." },
              { message: "Enter a valid phone number." },
              { message: "Include the country code." },
            ]}
          />
        </Field>
      </FieldSet>,
    );

    expect(
      screen.getByRole("group", { name: "Contact details" }),
    ).toBeVisible();
    const phone = screen.getByRole("textbox", { name: "Phone number" });
    expect(phone).toHaveAttribute("aria-describedby", "phone-help phone-error");
    const error = screen.getByRole("alert");
    expect(
      within(error).getAllByText("Enter a valid phone number."),
    ).toHaveLength(1);
    expect(error).toHaveTextContent("Include the country code.");
  });

  it("[V6] omits the error message when there are no errors", () => {
    render(<FieldError errors={[]} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
