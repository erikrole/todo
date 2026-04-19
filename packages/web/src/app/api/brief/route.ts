
export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json({ brief: null });
  }

  try {
    const { taskTitles, mode, date } = await request.json();

    const taskList =
      Array.isArray(taskTitles) && taskTitles.length > 0
        ? taskTitles.slice(0, 10).join(", ")
        : "no tasks scheduled";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4.5",
        max_tokens: 80,
        system: `You write concise, natural one-sentence daily briefings for a personal task manager. Tone: calm, warm, direct. No filler phrases like "It looks like" or "Today you have". Maximum 25 words. Never use em-dashes. Never start with "I".`,
        messages: [
          {
            role: "user",
            content: `Date: ${date}. Mode: ${mode}. Tasks today: ${taskList}. Write the briefing sentence.`,
          },
        ],
      }),
    });

    const data = await res.json();
    const brief = data.content?.[0]?.text?.trim() ?? null;
    return Response.json({ brief });
  } catch {
    return Response.json({ brief: null });
  }
}
