/**
 * Cloudflare Workers AI proxy — exposes an OpenAI-compatible /v1/chat/completions endpoint
 * backed by @cf/meta/llama-3.3-70b-instruct-fp8-fast (best available model on Workers AI).
 *
 * Bindings required (wrangler.ai-proxy.toml):
 *   AI        — Workers AI binding
 *   AI_SECRET — shared secret (set via `wrangler secret put AI_SECRET`)
 *
 * The Fly.io backend sets:
 *   LLM_BASE_URL = https://<this-worker>.workers.dev/v1
 *   LLM_API_KEY  = <AI_SECRET>
 *   LLM_MODEL    = @cf/meta/llama-3.3-70b-instruct-fp8-fast
 */

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        },
      });
    }

    if (url.pathname !== '/v1/chat/completions') {
      return new Response('Not found', { status: 404 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Shared-secret auth
    const auth = request.headers.get('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (env.AI_SECRET && token !== env.AI_SECRET) {
      return Response.json({ error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await request.json();
    const { messages, max_tokens = 2048, stream = false } = body;

    if (!stream) {
      const result = await env.AI.run(MODEL, { messages, max_tokens });
      return Response.json({
        choices: [{ message: { role: 'assistant', content: result.response }, finish_reason: 'stop', index: 0 }],
      });
    }

    // Streaming: transform CF AI SSE format → OpenAI SSE format
    // CF emits: data: {"response":"token","p":"..."}
    // OpenAI expects: data: {"choices":[{"delta":{"content":"token"}}]}
    const aiStream = await env.AI.run(MODEL, { messages, max_tokens, stream: true });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = aiStream.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              await writer.write(encoder.encode('data: [DONE]\n\n'));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.response) {
                const chunk = JSON.stringify({ choices: [{ delta: { content: parsed.response }, index: 0 }] });
                await writer.write(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        console.error('AI stream error:', err);
      } finally {
        await writer.close().catch(() => {});
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
