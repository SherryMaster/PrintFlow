import { notFound } from "next/navigation";
import {
  ArrowRight,
  FileCheck2,
  PackageCheck,
  UploadCloud,
} from "lucide-react";

import {
  formatLocalDate,
  formatMoney,
  formatShopInstant,
} from "@/ui/formatters";
import { AdminShell } from "@/ui/shells/admin-shell";
import { CustomerShell } from "@/ui/shells/customer-shell";
import { okPrintsFixtureTheme } from "@/ui/theme/fixtures";
import { Button } from "@/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/primitives/card";
import { FieldGroup } from "@/ui/primitives/field";
import {
  EmptyState,
  InlineOutcome,
  LoadingState,
  UploadProgress,
} from "@/ui/patterns/feedback";
import { ErrorSummary, TextField } from "@/ui/patterns/form-field";
import { OverlayExamples } from "@/ui/patterns/overlay-examples";
import { PriorityTable } from "@/ui/patterns/priority-table";
import { StatusBadge, StatusDetail } from "@/ui/patterns/status";
import { presentStatus } from "@/ui/status";
import { UploadInterruptionExample } from "./upload-interruption-example";

const orderStatus = presentStatus({
  label: "Artwork review",
  tone: "info",
  explanation: "Your file is being checked before production starts.",
});
const blockedStatus = presentStatus({
  label: "Needs a new file",
  tone: "warning",
  explanation: "The uploaded artwork is too small for the selected size.",
  nextAction: { label: "View artwork guidance", href: "#artwork-guidance" },
});
const readyStatus = presentStatus({
  label: "Ready for pickup",
  tone: "success",
});
const queueRows = [
  {
    reference: "PF-2026-0042",
    customer: "Ayesha K.",
    service: "Poster printing",
    due: "2026-09-24T09:00:00Z",
    status: orderStatus,
  },
  {
    reference: "PF-2026-0043",
    customer: "Hamza R.",
    service: "Business cards",
    due: "2026-09-25T07:30:00Z",
    status: blockedStatus,
  },
  {
    reference: "PF-2026-0044",
    customer: "Mariam S.",
    service: "Flyers",
    due: "2026-09-23T11:00:00Z",
    status: readyStatus,
  },
];

export default function UiShowcase() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <CustomerShell
        theme={okPrintsFixtureTheme}
        navigation={[
          { label: "Your order", href: "#customer-preview", active: true },
          { label: "Components", href: "#components" },
        ]}
        orderContext={
          <Card>
            <CardHeader>
              <CardTitle>Order at a glance</CardTitle>
              <CardDescription>
                Fixture data for the interface preview
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Reference</span>
                <strong className="min-w-0 break-words text-right">
                  PF-2026-0042
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Estimate</span>
                <strong className="min-w-0 break-words text-right">
                  {formatMoney("125000")}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Requested</span>
                <strong className="min-w-0 break-words text-right">
                  {formatLocalDate("2026-09-26")}
                </strong>
              </div>
            </CardContent>
          </Card>
        }
      >
        <section id="customer-preview" className="flex flex-col gap-8">
          <div className="rounded-3xl bg-card p-7 shadow-sm ring-1 ring-border sm:p-10">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Order progress
            </p>
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
              Your print is taking shape.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Follow every step, review artwork questions, and know when your
              order is ready.
            </p>
            <div className="mt-7">
              <StatusDetail status={orderStatus} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <FileCheck2 className="size-6 text-info" aria-hidden="true" />
                <CardTitle>1. Received</CardTitle>
                <CardDescription>Order details saved</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <UploadCloud className="size-6 text-info" aria-hidden="true" />
                <CardTitle>2. In review</CardTitle>
                <CardDescription>Artwork quality check</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <PackageCheck
                  className="size-6 text-muted-foreground"
                  aria-hidden="true"
                />
                <CardTitle>3. Pickup</CardTitle>
                <CardDescription>We will confirm when ready</CardDescription>
              </CardHeader>
            </Card>
          </div>
          <section id="components" className="grid gap-5">
            <h2 className="text-2xl font-bold">Shared components</h2>
            <Card>
              <CardHeader>
                <CardTitle>Contact details</CardTitle>
                <CardDescription>
                  Example form with required and error states
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-5">
                  <ErrorSummary
                    errors={[
                      {
                        id: "customer-email",
                        message: "Enter a valid email address.",
                      },
                    ]}
                  />
                  <FieldGroup>
                    <TextField
                      id="customer-name"
                      label="Your name"
                      required
                      placeholder="Full name"
                      description="Use the name we should put on your order."
                    />
                    <TextField
                      id="customer-email"
                      label="Email address"
                      type="email"
                      required
                      defaultValue="wrong-address"
                      error="Enter a valid email address."
                    />
                  </FieldGroup>
                  <Button type="submit" className="min-h-11 w-fit">
                    Continue{" "}
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </form>
              </CardContent>
            </Card>
            <UploadProgress filename="poster-artwork-final.pdf" percent={62} />
            <UploadInterruptionExample />
            <InlineOutcome kind="error" title="We could not accept that file">
              Please choose a PDF under the shop file limit and try again.
            </InlineOutcome>
            <InlineOutcome kind="success" title="Details saved">
              Your information is ready for the next step.
            </InlineOutcome>
            <InlineOutcome kind="blocked" title="Production is waiting">
              A new artwork file is needed before printing can begin.
            </InlineOutcome>
            <OverlayExamples />
            <div className="grid gap-5 sm:grid-cols-2">
              <EmptyState
                title="No proof yet"
                description="A proof will appear here after the artwork review."
              />
              <LoadingState />
            </div>
          </section>
        </section>
      </CustomerShell>
      <AdminShell
        theme={okPrintsFixtureTheme}
        heading="Production overview"
        description="A clear view of what needs attention across the shop today."
        navigation={[
          { label: "Overview", href: "#admin-preview", active: true },
          { label: "Orders", href: "#queue" },
          { label: "Artwork", href: "#artwork-guidance" },
        ]}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="#queue" />}
          >
            View queue <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        }
      >
        <section id="admin-preview" className="grid gap-7">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Needs review</CardDescription>
                <CardTitle className="text-3xl">04</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>In production</CardDescription>
                <CardTitle className="text-3xl">12</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Ready for pickup</CardDescription>
                <CardTitle className="text-3xl">03</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <div id="queue" className="grid gap-4">
            <div>
              <h2 className="text-2xl font-bold">Active orders</h2>
              <p className="text-sm text-muted-foreground">
                Fixture rows show the table and phone card patterns.
              </p>
            </div>
            <PriorityTable
              caption="Active orders"
              rows={queueRows}
              rowKey={(row) => row.reference}
              columns={[
                {
                  key: "reference",
                  heading: "Order",
                  render: (row) => <strong>{row.reference}</strong>,
                },
                {
                  key: "customer",
                  heading: "Customer",
                  render: (row) => row.customer,
                },
                {
                  key: "service",
                  heading: "Service",
                  render: (row) => row.service,
                  priority: "wide",
                },
                {
                  key: "due",
                  heading: "Due",
                  render: (row) => formatShopInstant(row.due, "Asia/Karachi"),
                },
                {
                  key: "status",
                  heading: "Status",
                  render: (row) => <StatusBadge status={row.status} />,
                },
              ]}
            />
          </div>
          <section id="artwork-guidance">
            <InlineOutcome kind="blocked" title="Artwork needs attention">
              One order is waiting for a higher resolution print file. Open that
              order from the real admin queue when the journey is connected.
            </InlineOutcome>
          </section>
        </section>
      </AdminShell>
    </>
  );
}
