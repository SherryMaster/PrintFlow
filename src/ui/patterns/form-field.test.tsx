import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ErrorSummary, TextField } from "./form-field";

afterEach(cleanup);

describe("form field patterns", () => {
  it("[V6] associates help and errors with a required field", () => {
    render(
      <TextField
        id="customer-email"
        label="Email address"
        required
        type="email"
        description="We send order updates here."
        error="Enter a valid email address."
      />,
    );

    const email = screen.getByRole("textbox", { name: "Email address *" });
    expect(email).toBeRequired();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(
      "We send order updates here. Enter a valid email address.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );
  });

  it("[V6] links each error summary item to the affected field", () => {
    render(
      <ErrorSummary
        errors={[
          { id: "customer-name", message: "Add your name." },
          { id: "customer-email", message: "Check your email." },
        ]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please fix these fields",
    );
    expect(
      screen.getByRole("link", { name: "Add your name." }),
    ).toHaveAttribute("href", "#customer-name");
    expect(
      screen.getByRole("link", { name: "Check your email." }),
    ).toHaveAttribute("href", "#customer-email");
  });

  it("[V6] omits the summary when there are no errors", () => {
    const { container } = render(<ErrorSummary errors={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
