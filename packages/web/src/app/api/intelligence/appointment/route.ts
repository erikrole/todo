import { db, tasks, taskCompletions } from "@todo/db";
import { asc, eq } from "drizzle-orm";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { err, ok, todayStr } from "@/lib/api";

export interface AppointmentSuggestion {
  suggestedDate: string; // YYYY-MM-DD
  reasoning: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return err("taskId required");

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return err("Not found", 404);

  const canonicalId = task.spawnedFromTaskId ?? task.id;

  const completionRows = await db
    .select({ completedAt: taskCompletions.completedAt })
    .from(taskCompletions)
    .where(eq(taskCompletions.taskId, canonicalId))
    .orderBy(asc(taskCompletions.completedAt));

  const today = todayStr();
  const history = completionRows.map((r) => r.completedAt.slice(0, 10));
  const historyText =
    history.length > 0
      ? `Past completions (most recent last): ${history.slice(-10).join(", ")}`
      : "No past completions on record.";

  const prompt = `You are scheduling a recurring personal appointment. Today is ${today}.

Routine: "${task.title}"
${historyText}

Suggest a specific date for the next appointment (YYYY-MM-DD) and a single short sentence of reasoning (max 12 words, no filler phrases).

Respond with exactly two lines:
DATE: YYYY-MM-DD
REASON: <one sentence>`;

  const { text } = await generateText({
    model: anthropic("claude-haiku-4.5"),
    prompt,
    maxOutputTokens: 64,
  });

  const dateMatch = text.match(/DATE:\s*(\d{4}-\d{2}-\d{2})/);
  const reasonMatch = text.match(/REASON:\s*(.+)/);

  if (!dateMatch) return err("Could not parse suggestion");

  return ok<AppointmentSuggestion>({
    suggestedDate: dateMatch[1],
    reasoning: reasonMatch?.[1]?.trim() ?? "",
  });
}
