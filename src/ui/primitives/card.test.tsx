import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

afterEach(cleanup);

describe("Card", () => {
  it("[V6] keeps order context and its action together", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Card>
        <CardHeader>
          <CardTitle>Order PF-2026-0042</CardTitle>
          <CardDescription>Artwork is under review.</CardDescription>
          <CardAction>
            <button type="button" onClick={onClick}>
              Open order
            </button>
          </CardAction>
        </CardHeader>
        <CardContent>Estimate: PKR 1,250.00</CardContent>
        <CardFooter>Pickup only</CardFooter>
      </Card>,
    );

    expect(screen.getByText("Order PF-2026-0042")).toBeVisible();
    expect(screen.getByText("Artwork is under review.")).toBeVisible();
    expect(screen.getByText("Estimate: PKR 1,250.00")).toBeVisible();
    expect(screen.getByText("Pickup only")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Open order" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
