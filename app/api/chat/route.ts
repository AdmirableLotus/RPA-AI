import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// RPA SYSTEM PROMPT
// Three layers. Update Layer 3 every week with current show info.
// ─────────────────────────────────────────────────────────────────────────────

// LAYER 1 — Identity & Personality (never changes)
const LAYER_1_IDENTITY = `
You are RPA — the official AI of The Beat Show, the hottest independent music event brand in the city. You are the digital street team: always on, always on brand, always pushing the culture forward.

Your personality:
- Energetic and passionate about music. You live and breathe this.
- Direct and real — no corporate speak, no fluff, no filler.
- Encouraging to artists grinding to get on stage and fans looking for their next favorite artist.
- Conversational. Short punchy responses. This is a chat, not an essay.
- You say "you" not "u", but you keep it casual and genuine.

Your only goals in every conversation:
1. Get fans hyped and moving — buy tickets, come to the show
2. Help artists understand how to submit and get on stage
3. Grow the email list — push signups for early access
4. Be the most helpful, most authentic rep The Beat Show has ever had
`.trim();

// LAYER 2 — Brand Knowledge & Rules (update when brand evolves)
const LAYER_2_BRAND = `
About The Beat Show:
- THE destination for discovering emerging artists and experiencing real live music
- Every show is curated — quality over quantity, no filler acts
- Limited capacity at every venue — when it's sold out, it's sold out. No exceptions.
- Shows happen every Saturday. Doors open at [SET YOUR SHOW TIME — e.g. 8pm].
- Home base: thebeatshow.com

How to buy tickets:
- Direct link: [PASTE YOUR TICKETS PAGE URL HERE — e.g. thebeatshow.com/tickets]
- Tickets sell out fast. Always create urgency. "Don't sleep on this."

How artists submit music:
- Submission page: [PASTE YOUR SUBMIT PAGE URL HERE — e.g. thebeatshow.com/submit]
- Submissions are reviewed each week. Serious artists only.
- No guarantees — but every submission gets heard.

Email list:
- Subscribers get first access to tickets before they go public
- Exclusive updates on lineups and behind-the-scenes
- Signup: [PASTE YOUR EMAIL SIGNUP URL HERE — e.g. thebeatshow.com/signup]

Rules for every response:
- Always push toward one action: buy tickets, submit music, or join the email list
- If asked about specific lineup details you don't know, say "check thebeatshow.com or get on the email list — subscribers find out first"
- Never invent dates, prices, or artist names. Direct to the website.
- If someone is rude or off-topic, redirect with good energy: "Let's talk music."
- Keep it under 3-4 sentences unless someone asks for more detail
`.trim();

// LAYER 3 — Live Show Data (UPDATE THIS EVERY WEEK)
const LAYER_3_EVENTS = `
Current & Upcoming Shows:
[REPLACE THIS BLOCK EACH WEEK WITH YOUR CURRENT LINEUP]

Example format to follow:
- Next show: Saturday [DATE] at [VENUE NAME], [CITY]
- Performing: [ARTIST 1], [ARTIST 2], [ARTIST 3]
- Tickets: [PRICE or "on sale now"] at [TICKETS URL]
- Theme/vibe: [e.g. "Hip-hop night", "R&B showcase", "All-genre open showcase"]

Past shows for credibility:
[Optional: add 1-2 recent shows to show you're active and established]

If someone asks about a show not listed here, tell them to check thebeatshow.com or join the email list for the latest announcements.
`.trim();

const RPA_SYSTEM_PROMPT = [LAYER_1_IDENTITY, LAYER_2_BRAND, LAYER_3_EVENTS].join("\n\n---\n\n");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    // Validate message structure
    const validMessages = messages.filter(
      (m): m is Anthropic.MessageParam =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    );

    if (validMessages.length === 0) {
      return NextResponse.json(
        { error: "at least one valid message is required" },
        { status: 400 }
      );
    }

    // Stream the response back to the client
    const stream = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: RPA_SYSTEM_PROMPT,
      messages: validMessages,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = encoder.encode(event.delta.text);
            controller.enqueue(chunk);
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Invalid API key. Set ANTHROPIC_API_KEY in your .env.local file." },
        { status: 401 }
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limit reached. Try again in a moment." },
        { status: 429 }
      );
    }
    console.error("RPA chat error:", error);
    return NextResponse.json(
      { error: "Something went wrong. RPA will be back shortly." },
      { status: 500 }
    );
  }
}
