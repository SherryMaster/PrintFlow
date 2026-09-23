import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminShell } from "./admin-shell";
import { safeAppTheme } from "@/ui/theme/theme";

afterEach(cleanup);

describe("AdminShell", () => {
  it("[V6] exposes workspace navigation and the active queue heading", () => {
    render(
      <AdminShell
        theme={safeAppTheme("Pilot shop")}
        heading="Orders"
        description="Work that needs attention today."
        navigation={[
          { label: "Overview", href: "/admin", active: false },
          { label: "Orders", href: "/admin/orders", active: true },
        ]}
        actions={<button type="button">New order</button>}
      >
        <p>Queue content</p>
      </AdminShell>,
    );

    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#admin-content");
    expect(
      screen.getByRole("complementary", { name: "Shop workspace" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Admin navigation" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("heading", { name: "Orders" })).toBeVisible();
    expect(screen.getByText("Work that needs attention today.")).toBeVisible();
    expect(screen.getByRole("button", { name: "New order" })).toBeVisible();
  });
});
