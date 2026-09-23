import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert";

afterEach(cleanup);

describe("Alert", () => {
  it("[V6] presents an error with its recovery action", () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Upload failed</AlertTitle>
        <AlertDescription>Choose another file and try again.</AlertDescription>
        <AlertAction>
          <button type="button">Choose file</button>
        </AlertAction>
      </Alert>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Upload failed");
    expect(alert).toHaveTextContent("Choose another file and try again.");
    expect(
      within(alert).getByRole("button", { name: "Choose file" }),
    ).toBeVisible();
  });
});
