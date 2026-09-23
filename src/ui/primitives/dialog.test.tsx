import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

afterEach(cleanup);

describe("Dialog", () => {
  it("[V6] opens with a named explanation and restores focus when closed", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger render={<Button variant="outline" />}>
          Artwork guidance
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Artwork requirements</DialogTitle>
            <DialogDescription>
              Upload a PDF at the final print size.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button />}>Got it</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Artwork guidance" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: "Artwork requirements",
    });
    expect(
      within(dialog).getByText("Upload a PDF at the final print size."),
    ).toBeVisible();

    await user.click(within(dialog).getByRole("button", { name: "Got it" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
