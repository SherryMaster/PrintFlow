import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriorityTable } from "./priority-table";

type Order = { reference: string; customer: string; service: string };

const columns = [
  { key: "reference", heading: "Order", render: (row: Order) => row.reference },
  {
    key: "customer",
    heading: "Customer",
    render: (row: Order) => row.customer,
  },
  {
    key: "service",
    heading: "Service",
    render: (row: Order) => row.service,
    priority: "wide" as const,
  },
];

afterEach(cleanup);

describe("PriorityTable", () => {
  it("[V6] keeps all order details in the table and priority details in phone cards", () => {
    render(
      <PriorityTable
        caption="Active orders"
        rows={[
          {
            reference: "PF-2026-0042",
            customer: "Ayesha Khan",
            service: "Large format printing",
          },
        ]}
        columns={columns}
        rowKey={(row) => row.reference}
      />,
    );

    const table = screen.getByRole("table", { name: "Active orders" });
    expect(within(table).getByText("Large format printing")).toBeVisible();
    const cards = screen.getByRole("list", { name: "Active orders" });
    const card = within(cards).getByRole("listitem");
    expect(card).toHaveTextContent("PF-2026-0042");
    expect(card).toHaveTextContent("Ayesha Khan");
    expect(card).not.toHaveTextContent("Large format printing");
  });

  it("[V6] gives an empty queue a useful message", () => {
    render(
      <PriorityTable
        caption="Active orders"
        rows={[]}
        columns={columns}
        rowKey={(row) => row.reference}
        emptyMessage="No orders need attention."
      />,
    );

    expect(screen.getByText("No orders need attention.")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
