import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/app/app-shell";
import { AuthProvider } from "@/lib/auth";

function NotFoundComponent() {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><p className="eyebrow mb-3">WK Health</p><h1 className="display text-7xl">404</h1><h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2><p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p><div className="mt-6"><Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background">Go home</Link></div></div></div>;
}
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center"><p className="eyebrow mb-3">WK Health / Error</p><h1 className="display text-3xl">This page didn't load</h1><p className="mt-2 text-sm text-muted-foreground">Something went wrong. You can try again or head home.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button onClick={() => { router.invalidate(); reset(); }} className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background">Try again</button><a href="/" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground">Go home</a></div></div></div>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    { title: "WK Health — Health OS" },
    { name: "description", content: "WK Health — สุขภาพ โภชนาการ การเคลื่อนไหว และผู้ช่วย AI ในระบบเดียว" },
    { name: "theme-color", content: "#111111" },
    { property: "og:title", content: "WK Health — AI Health Operating System" },
    { property: "og:description", content: "A calm, premium health operating system powered by WK AI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ], links: [
    { rel: "stylesheet", href: appCss },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" },
    { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
  ] }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
function RootShell({ children }: { children: ReactNode }) { return <html lang="th"><head><HeadContent /></head><body>{children}<Scripts /></body></html>; }
function RootComponent() { const { queryClient } = Route.useRouteContext(); return <QueryClientProvider client={queryClient}><AuthProvider><AppShell><Outlet /></AppShell></AuthProvider></QueryClientProvider>; }
