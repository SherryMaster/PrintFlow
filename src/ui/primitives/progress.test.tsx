import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Progress, ProgressLabel, ProgressValue } from "./progress";

afterEach(cleanup);

describe("Progress", () => {
  it("[V6] announces the current upload progress", () => {
    render(
      <Progress value={42}>
        <ProgressLabel>Artwork upload</ProgressLabel>
        <ProgressValue />
      </Progress>,
    );

    const progress = screen.getByRole("progressbar", {
      name: "Artwork upload",
    });
    expect(progress).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("42%")).toBeVisible();
  });
});
