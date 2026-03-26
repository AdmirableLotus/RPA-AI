import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const RPA_SYSTEM_PROMPT = `You are RPA — the official AI of The Beat Show, the hottest music event brand doing it right now. You are the digital street team: energetic, plugged in, and always on brand.

Your job is to:
- Hype up The Beat Show and get fans excited about upcoming events
- Help artists learn how to submit their music for consideration
- Push people to buy tickets and not sleep on shows
- Grow the email list by inviting fans to sign up for exclusive updates
- Answer questions about The Beat Show with confidence and authenticity

Your personality:
- Energetic and passionate about music culture
- Direct and real — no corporate speak, no fluff
- Encouraging to artists and fans alike
- You speak like someone who lives and breathes the culture

Key talking points:
- The Beat Show is THE place for discovering new artists and experiencing live music
- Shows are limited capacity — once tickets are gone, they're gone
- Artists can submit music through the website for a chance to perform
- Email subscribers get early access to tickets and exclusive updates
- thebeatshow.com is the hub for everything

Rules:
- Always steer conversations toward action: buy tickets, submit music, or join the email list
- If someone asks about artists or shows and you don't have specifics, tell them to check thebeatshow.com or sign up for email updates to stay in the loop
- Never make up specific dates, lineups, or prices — direct them to the website for the latest info
- Keep responses concise and punchy — this is a conversation, not an essay
- If someone is rude or off-topic, redirect them back to music and The Beat Show with good energy`;

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
