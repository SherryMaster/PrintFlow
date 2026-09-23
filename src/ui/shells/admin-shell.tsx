import { StoreIdentity } from "@/ui/patterns/store-identity";
import type { NavigationItem } from "./customer-shell";
import type { ResolvedTheme } from "@/ui/theme/theme";
import { themeStyle } from "@/ui/theme/theme";

export function AdminShell({
  theme,
  navigation,
  heading,
  description,
  actions,
  children,
}: {
  theme: ResolvedTheme;
  navigation: NavigationItem[];
  heading: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={themeStyle(theme)}
      className="min-h-screen bg-background text-foreground"
    >
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside
          className="border-b border-border bg-card px-5 py-5 lg:border-b-0 lg:border-r"
          aria-label="Shop workspace"
        >
          <StoreIdentity identity={theme.identity} />
          <nav
            aria-label="Admin navigation"
            className="mt-5 flex gap-1 overflow-x-auto lg:flex-col"
          >
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={`min-h-11 shrink-0 rounded-lg px-3 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${item.active ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <main id="admin-content" className="min-w-0 px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Shop workspace
                </p>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {heading}
                </h1>
                {description && (
                  <p className="mt-2 max-w-2xl text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              {actions}
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
