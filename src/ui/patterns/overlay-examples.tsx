"use client";

import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/primitives/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/ui/primitives/sheet";

export function OverlayExamples() {
  return (
    <section
      aria-labelledby="overlay-heading"
      className="rounded-xl border border-border bg-card p-5"
    >
      <h3 id="overlay-heading" className="font-semibold">
        Overlay patterns
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        The same guidance remains available in the page below.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            Artwork guidance dialog
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Artwork guidance</DialogTitle>
              <DialogDescription>
                For the clearest print, upload a PDF at the final size with
                images at 300 dpi.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button />}>Got it</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>
            Order details drawer
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Order details</SheetTitle>
              <SheetDescription>
                Reference PF-2026-0042 is in artwork review. Your current
                estimate is shown in the order summary.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </div>
      <p
        id="artwork-guidance-copy"
        className="mt-5 text-sm text-muted-foreground"
      >
        Artwork guidance: upload a PDF at the final size with images at 300 dpi.
      </p>
    </section>
  );
}
