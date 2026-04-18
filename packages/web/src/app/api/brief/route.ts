import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ brief: null }, { status: 200 });
  }

  const { taskTitles, mode, date } = await request.json();

  const client = new Anthropic({ apiKey: key });

  const taskList =
    Array.isArray(taskTitles) && taskTitles.length > 0
      ? taskTitles.slice(0, 10).join(", ")
      : "no tasks scheduled";

  const systemPrompt = `You write concise, natural one-sentence daily briefings for a personal task manager.
Tone: calm, warm, direct. No filler phrases like "It looks like" or "Today you have".
Maximum 25 words. Never use em-dashes. Never start with "I".`;

  const userPrompt = `Date: ${date}. Mode: ${mode}. Tasks today: ${taskList}. Write the briefing sentence.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const brief = message.content[0].type === "text" ? message.content[0].text.trim() : null;
  return NextResponse.json({ brief });
}
