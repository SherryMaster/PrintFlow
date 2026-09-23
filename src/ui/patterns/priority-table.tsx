import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/primitives/table";

export type PriorityColumn<Row> = {
  key: string;
  heading: string;
  render: (row: Row) => React.ReactNode;
  priority?: "always" | "wide";
};

export function PriorityTable<Row>({
  caption,
  rows,
  columns,
  rowKey,
  emptyMessage = "No items yet",
}: {
  caption: string;
  rows: readonly Row[];
  columns: readonly PriorityColumn<Row>[];
  rowKey: (row: Row) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0)
    return (
      <p className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        {emptyMessage}
      </p>
    );
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.heading}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell key={column.key}>{column.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={caption} className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className="rounded-xl border border-border bg-card p-4"
          >
            <dl className="grid gap-3">
              {columns
                .filter((column) => column.priority !== "wide")
                .map((column) => (
                  <div
                    key={column.key}
                    className="flex items-start justify-between gap-4"
                  >
                    <dt className="text-sm text-muted-foreground">
                      {column.heading}
                    </dt>
                    <dd className="text-right text-sm font-medium">
                      {column.render(row)}
                    </dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
