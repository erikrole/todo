import Anthropic from "@anthropic-ai/sdk";
import { ProjectPlanSchema, type ProjectPlan } from "./architect-schema.js";
import { buildArchitectSystemPrompt } from "./prompts.js";

// JSON Schema for the submit_project_plan tool — mirrors ProjectPlanSchema
const SUBMIT_TOOL_SCHEMA = {
  type: "object" as const,
  required: ["project", "sections", "tasks"],
  properties: {
    project: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        notes: { type: "string" },
        color: { type: "string" },
        areaId: { type: "string" },
      },
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        required: ["tempId", "title", "position"],
        properties: {
          tempId: { type: "string" },
          title: { type: "string" },
          position: { type: "number" },
        },
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        required: ["tempId", "title"],
        properties: {
          tempId: { type: "string" },
          title: { type: "string" },
          notes: { type: "string" },
          whenDate: { type: "string" },
          timeOfDay: { type: "string", enum: ["morning", "day", "night"] },
          deadline: { type: "string" },
          sectionTempId: { type: "string" },
          parentTaskTempId: { type: "string" },
        },
      },
    },
  },
};

export async function generateProjectPlan(
  brief: string,
  opts: { model?: string; areaId?: string; today?: string } = {},
): Promise<ProjectPlan> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment before using the architect tools.",
    );
  }

  const client = new Anthropic({ apiKey });
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const model = opts.model ?? process.env["ARCHITECT_MODEL"] ?? "claude-sonnet-4-5";

  const userMessage = opts.areaId
    ? `Project brief: ${brief}\n\nAssign the project to areaId: ${opts.areaId}`
    : `Project brief: ${brief}`;

  async function attempt(extraContext?: string): Promise<ProjectPlan> {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
    if (extraContext) {
      messages.push(
        { role: "assistant", content: [{ type: "text", text: "I understand. Let me correct the plan." }] },
        { role: "user", content: extraContext },
      );
    }

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: buildArchitectSystemPrompt(today),
      tools: [
        {
          name: "submit_project_plan",
          description: "Submit the complete project plan",
          input_schema: SUBMIT_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "submit_project_plan" },
      messages,
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) {
      throw new Error("Claude did not call submit_project_plan. Raw response: " + JSON.stringify(response.content));
    }

    const parsed = ProjectPlanSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new Error("Schema validation failed: " + JSON.stringify(parsed.error.flatten()));
    }

    return parsed.data;
  }

  // One retry on validation failure, feeding the error back as context
  try {
    return await attempt();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Schema validation failed:")) {
      return await attempt(`The plan you submitted had validation errors. Please fix and resubmit.\n\nErrors: ${err.message}`);
    }
    throw err;
  }
}
