import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("[V6] triggers its action and blocks it when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Continue</Button>
        <Button disabled onClick={onClick}>
          Save order
        </Button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Save order" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Save order" })).toBeDisabled();
  });

  it("[V6] applies button semantics to its non-native render element", () => {
    render(
      <Button nativeButton={false} render={<a href="/orders" />}>
        Review orders
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Review orders" });
    expect(button.tagName).toBe("A");
    expect(button).toHaveAttribute("href", "/orders");
  });
});
