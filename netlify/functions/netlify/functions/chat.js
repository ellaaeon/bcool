export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are B-Cool Ref. & Air-conditioning Services assistant. Be friendly and concise. Ask for location and contact number when booking. Services: AC repair, installation/uninstallation, gas charging, maintenance/cleaning, refrigerator and washing machine repair. Offer free check-up and prompt scheduling.",
          },
          { role: "user", content: message },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return new Response(JSON.stringify({ error: "OpenAI error", details: errText }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const reply = data.output_text || "Sorry, I couldn’t generate a reply. Please try again.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error", details: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
