import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoreIdentity } from "./store-identity";

const brandedIdentity = {
  name: "OkPrints",
  tagline: "Print with confidence",
  logo: {
    src: "/branding/okprints/ok-prints.png",
    alt: "OkPrints logo",
  },
};

afterEach(cleanup);

describe("StoreIdentity", () => {
  it("[V1] shows the logo and meaningful text alternative", () => {
    render(<StoreIdentity identity={brandedIdentity} />);

    expect(
      screen.getByRole("img", { name: "OkPrints logo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Print with confidence")).toBeVisible();
  });

  it("[V1] keeps a readable store name when the logo fails", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<StoreIdentity identity={brandedIdentity} />);
    fireEvent.error(screen.getByRole("img", { name: "OkPrints logo" }));

    expect(screen.getByText("OkPrints", { exact: true })).toBeVisible();
    expect(screen.getByText("Print with confidence")).toBeVisible();
    expect(warning).toHaveBeenCalledWith("brand_asset_failed", {
      asset: "/branding/okprints/ok-prints.png",
    });
    warning.mockRestore();
  });

  it("[V1] shows the store name without a logo", () => {
    render(<StoreIdentity identity={{ name: "Pilot shop" }} />);

    expect(screen.getByText("Pilot shop", { exact: true })).toBeVisible();
  });
});
