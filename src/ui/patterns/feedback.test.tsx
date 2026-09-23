import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  EmptyState,
  InlineOutcome,
  LoadingState,
  UploadProgress,
} from "./feedback";

afterEach(cleanup);

describe("feedback patterns", () => {
  it.each([
    ["error", "alert"],
    ["blocked", "alert"],
    ["success", "status"],
  ] as const)("[V6] announces a %s outcome as a %s", (kind, role) => {
    render(
      <InlineOutcome kind={kind} title="Artwork needs review">
        Upload a clearer file before production starts.
      </InlineOutcome>,
    );

    expect(screen.getByRole(role)).toHaveTextContent("Artwork needs review");
    expect(screen.getByRole(role)).toHaveTextContent(
      "Upload a clearer file before production starts.",
    );
  });

  it("[V6] explains why a proof list is empty", () => {
    render(
      <EmptyState
        title="No proof yet"
        description="A proof appears after artwork review."
      />,
    );

    expect(screen.getByText("No proof yet")).toBeVisible();
    expect(
      screen.getByText("A proof appears after artwork review."),
    ).toBeVisible();
  });

  it("[V6] announces loading while placeholder shapes remain present", () => {
    render(<LoadingState />);

    expect(
      screen.getByRole("status", { name: "Loading content" }),
    ).toBeVisible();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it.each([
    [-12, "0"],
    [140, "100"],
  ])("[V6] clamps upload progress %i to %s percent", (percent, expected) => {
    render(<UploadProgress filename="artwork.pdf" percent={percent} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      `${expected}% uploaded`,
    );
    expect(
      screen.getByRole("progressbar", { name: "File upload progress" }),
    ).toHaveAttribute("aria-valuenow", expected);
  });

  it("[V6] replaces progress with a clear interruption message", () => {
    render(<UploadProgress filename="artwork.pdf" percent={27} interrupted />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Upload interrupted. Try again.",
    );
  });
});
