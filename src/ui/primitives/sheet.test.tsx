import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

afterEach(cleanup);

describe("Sheet", () => {
  it("[V6] opens order details and closes with Escape", async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger render={<Button variant="outline" />}>
          Order details
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Order PF-2026-0042</SheetTitle>
            <SheetDescription>Artwork review is in progress.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    const trigger = screen.getByRole("button", { name: "Order details" });
    await user.click(trigger);
    const sheet = await screen.findByRole("dialog", {
      name: "Order PF-2026-0042",
    });
    expect(sheet).toHaveTextContent("Artwork review is in progress.");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
