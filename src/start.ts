import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  // WK Health is an authenticated client-side health dashboard. Disable
  // server rendering by default so browser-only auth/GPS/media code cannot
  // hold Render's SSR stream open. The HTML shell still renders on the server
  // and the app hydrates normally in the browser.
  defaultSsr: false,
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
