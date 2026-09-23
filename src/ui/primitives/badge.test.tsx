import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "./badge";

afterEach(cleanup);

describe("Badge", () => {
  it("[V6] can present a status as a link when an action is available", () => {
    render(
      <Badge variant="secondary" render={<a href="/orders/PF-42" />}>
        View order
      </Badge>,
    );

    expect(screen.getByRole("link", { name: "View order" })).toHaveAttribute(
      "href",
      "/orders/PF-42",
    );
  });
});
