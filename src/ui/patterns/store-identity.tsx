"use client";

import { useState } from "react";
import Image from "next/image";

import type { ResolvedTheme } from "@/ui/theme/theme";

export function StoreIdentity({
  identity,
}: {
  identity: ResolvedTheme["identity"];
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="flex min-h-11 min-w-0 max-w-full items-center gap-3">
      {identity.logo && !imageFailed && (
        <Image
          src={identity.logo.src}
          alt={identity.logo.alt}
          width={155}
          height={33}
          onError={() => {
            setImageFailed(true);
            console.warn("brand_asset_failed", { asset: identity.logo?.src });
          }}
          className="h-auto max-h-11 w-auto max-w-36 object-contain"
        />
      )}
      <div className="min-w-0">
        {(!identity.logo || imageFailed) && (
          <strong className="block break-words text-base font-bold tracking-tight">
            {identity.name}
          </strong>
        )}
        {identity.tagline && (
          <span className="block break-words text-xs text-muted-foreground">
            {identity.tagline}
          </span>
        )}
      </div>
    </div>
  );
}
