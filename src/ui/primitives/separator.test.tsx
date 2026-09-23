import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Separator } from "./separator";

afterEach(cleanup);

describe("Separator", () => {
  it("[V6] exposes its orientation to assistive technology", () => {
    render(
      <>
        <Separator />
        <Separator orientation="vertical" />
      </>,
    );

    const separators = screen.getAllByRole("separator");
    expect(separators[0]).toHaveAttribute("aria-orientation", "horizontal");
    expect(separators[1]).toHaveAttribute("aria-orientation", "vertical");
  });
});
