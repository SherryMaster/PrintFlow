import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("[V6] can remain decorative inside an announced loading state", () => {
    render(
      <div role="status" aria-label="Loading orders">
        <Skeleton aria-hidden="true" />
        <span>Loading orders</span>
      </div>,
    );

    expect(
      screen.getByRole("status", { name: "Loading orders" }),
    ).toBeVisible();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("Loading orders")).toBeVisible();
  });
});
