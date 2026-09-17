import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RootLayout, { metadata } from "./layout";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
}));

describe("RootLayout", () => {
  it("publishes the PrintFlow page metadata", () => {
    expect(metadata).toMatchObject({
      title: "PrintFlow",
      description:
        "Print order intake and production workflow for a digital print shop.",
    });
  });

  it("renders an English document containing the page content", () => {
    const markup = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <main>PrintFlow workspace</main>
      </RootLayout>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");

    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(document.body.textContent).toContain("PrintFlow workspace");
  });
});
