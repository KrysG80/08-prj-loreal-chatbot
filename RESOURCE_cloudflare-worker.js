// worker-loreal.js
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    try {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
          { headers: cors, status: 500 }
        );
      }

      const body = await request.json();
      const messages = body?.messages ?? [];

      const payload = {
        model: "gpt-4o",
        messages,
        max_completion_tokens: 600,
      };

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await r.json();
      return new Response(JSON.stringify(data), {
        headers: cors,
        status: r.status,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        headers: cors,
        status: 500,
      });
    }
  },
};
