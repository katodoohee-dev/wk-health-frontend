const BACKEND_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "https://wk-health-backend.onrender.com").replace(/\/$/, "");

export async function proxyBackend(request: Request, path: string, method = request.method) {
  const headers = new Headers({ "Content-Type": "application/json" });
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
  const response = await fetch(`${BACKEND_URL}${path}`, { method, headers, body });
  const text = await response.text();
  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", response.headers.get("content-type") ?? "application/json");
  return new Response(text, { status: response.status, headers: responseHeaders });
}
