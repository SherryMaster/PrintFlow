import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Spinner } from "./spinner";

afterEach(cleanup);

describe("Spinner", () => {
  it("[V6] announces its loading state", () => {
    render(<Spinner />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
