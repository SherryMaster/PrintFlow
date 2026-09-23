import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";

afterEach(cleanup);

describe("Empty", () => {
  it("[V6] explains an empty order list and keeps the next action visible", () => {
    render(
      <Empty>
        <EmptyMedia variant="icon" aria-hidden="true">
          <span>0</span>
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No orders yet</EmptyTitle>
          <EmptyDescription>
            New orders will appear in this queue.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <a href="/orders/new">Create an assisted order</a>
        </EmptyContent>
      </Empty>,
    );

    expect(screen.getByText("No orders yet")).toBeVisible();
    expect(
      screen.getByText("New orders will appear in this queue."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Create an assisted order" }),
    ).toHaveAttribute("href", "/orders/new");
  });
});
