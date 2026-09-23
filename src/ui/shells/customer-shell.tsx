import { StoreIdentity } from "@/ui/patterns/store-identity";
import type { ResolvedTheme } from "@/ui/theme/theme";
import { themeStyle } from "@/ui/theme/theme";

export type NavigationItem = { label: string; href: string; active?: boolean };

export function CustomerShell({
  theme,
  navigation,
  orderContext,
  children,
}: {
  theme: ResolvedTheme;
  navigation?: NavigationItem[];
  orderContext?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={themeStyle(theme)}
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <StoreIdentity identity={theme.identity} />
          {navigation && (
            <nav
              aria-label="Customer navigation"
              className="flex flex-wrap gap-1"
            >
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-12"
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {children}
          {orderContext && (
            <aside aria-label="Order context">{orderContext}</aside>
          )}
        </div>
      </main>
      <footer className="border-t border-border bg-card px-5 py-5 text-center text-sm text-muted-foreground">
        Print details clearly. Keep every order moving.
      </footer>
    </div>
  );
}
