import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { UploadInterruptionExample } from "./upload-interruption-example";

afterEach(cleanup);

describe("UploadInterruptionExample", () => {
  it("[V6] lets the customer retry an interrupted upload", async () => {
    const user = userEvent.setup();
    render(<UploadInterruptionExample />);

    expect(screen.getByRole("status")).toHaveTextContent("27% uploaded");
    await user.click(screen.getByRole("button", { name: "Interrupt upload" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Upload interrupted. Try again.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Retry the upload");

    await user.click(screen.getByRole("button", { name: "Retry upload" }));
    expect(screen.getByRole("status")).toHaveTextContent("27% uploaded");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
