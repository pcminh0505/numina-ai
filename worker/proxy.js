/**
 * Cloudflare Worker: serves the Vite static build and proxies /api/* to Fly.io backend.
 * SSE streaming is fully supported — CF Workers pass through ReadableStream responses.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy all /api/* requests to the Fly.io backend
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, env.BACKEND_URL);
      return fetch(target.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
    }

    // Serve static assets; fall back to index.html for SPA client-side routing
    const response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      return env.ASSETS.fetch(new Request(new URL('/index.html', url).toString()));
    }
    return response;
  },
};
