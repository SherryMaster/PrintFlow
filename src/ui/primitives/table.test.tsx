import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

afterEach(cleanup);

describe("Table", () => {
  it("[V6] exposes order rows with their headings and summary", () => {
    render(
      <Table>
        <TableCaption>Orders ready for pickup</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Reference</TableHead>
            <TableHead scope="col">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>PF-2026-0042</TableCell>
            <TableCell>Ready for pickup</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>1 order</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    const table = screen.getByRole("table", {
      name: "Orders ready for pickup",
    });
    expect(
      within(table).getByRole("columnheader", { name: "Reference" }),
    ).toBeVisible();
    expect(
      within(table).getByRole("row", { name: "PF-2026-0042 Ready for pickup" }),
    ).toBeVisible();
    expect(within(table).getByText("1 order")).toBeVisible();
  });
});
