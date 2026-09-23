import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
} from "lucide-react";

import { Button } from "@/ui/primitives/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/primitives/card";
import { CustomerShell } from "@/ui/shells/customer-shell";
import { safeAppTheme } from "@/ui/theme/theme";

export default function Home() {
  return (
    <CustomerShell theme={safeAppTheme("PrintFlow")}>
      <div className="lg:col-span-2">
        <section className="rounded-3xl bg-card px-6 py-14 shadow-sm ring-1 ring-border sm:px-12 sm:py-20">
          <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Print ordering, made clear
          </p>
          <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            From first file to final pickup.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            PrintFlow brings order details, artwork review, production updates,
            and pickup information together in one simple path.
          </p>
          <p className="mt-8 text-sm text-muted-foreground">
            The first shop ordering journey is being prepared.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <Button
              className="mt-5 min-h-11"
              nativeButton={false}
              render={<a href="/dev/ui" />}
            >
              View UI foundation{" "}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          )}
        </section>
        <section
          aria-label="How it works"
          className="mt-10 grid gap-4 md:grid-cols-3"
        >
          <Card>
            <CardHeader>
              <ClipboardList className="size-6 text-info" aria-hidden="true" />
              <CardTitle>Set your print details</CardTitle>
              <CardDescription>
                Choose what you need and see the important choices before
                submitting.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CheckCircle2
                className="size-6 text-success"
                aria-hidden="true"
              />
              <CardTitle>Review with confidence</CardTitle>
              <CardDescription>
                Artwork questions and production status stay easy to follow.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <PackageCheck className="size-6 text-info" aria-hidden="true" />
              <CardTitle>Know when to collect</CardTitle>
              <CardDescription>
                See the confirmed next step when your work is ready.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </div>
    </CustomerShell>
  );
}
