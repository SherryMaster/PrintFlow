import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";

afterEach(cleanup);

describe("Select", () => {
  it("[V6] lets a customer choose a print type", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="Print type">
          <SelectValue placeholder="Choose a print type" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Printing</SelectLabel>
            <SelectItem value="colour">Colour</SelectItem>
            <SelectItem value="black-and-white">Black and white</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Print type" });
    expect(trigger).toHaveTextContent("Choose a print type");
    await user.click(trigger);
    await user.click(
      await screen.findByRole("option", { name: "Black and white" }),
    );

    expect(onValueChange).toHaveBeenCalledWith(
      "black-and-white",
      expect.any(Object),
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("[V6] keeps an unavailable choice disabled", () => {
    render(
      <Select disabled>
        <SelectTrigger aria-label="Print type">
          <SelectValue placeholder="Choose a print type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="colour">Colour</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole("combobox", { name: "Print type" })).toBeDisabled();
  });
});
