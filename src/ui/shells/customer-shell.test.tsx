import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CustomerShell } from "./customer-shell";
import { safeAppTheme } from "@/ui/theme/theme";

afterEach(cleanup);

describe("CustomerShell", () => {
  it("[V6] provides skip navigation, order context, and current page navigation", () => {
    render(
      <CustomerShell
        theme={safeAppTheme("Pilot shop")}
        navigation={[
          { label: "Your order", href: "/orders/42", active: true },
          { label: "Help", href: "/help" },
        ]}
        orderContext={<p>Reference PF-2026-0042</p>}
      >
        <h1>Track your order</h1>
      </CustomerShell>,
    );

    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { name: "Track your order" }),
    );
    expect(
      screen.getByRole("navigation", { name: "Customer navigation" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Your order" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("complementary", { name: "Order context" }),
    ).toHaveTextContent("Reference PF-2026-0042");
  });
});
