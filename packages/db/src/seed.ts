/**
 * Dev seed — run with: npx tsx packages/db/src/seed.ts
 * Populates local.db with sample areas, projects, and tasks.
 */
import { nanoid } from "nanoid";
import { db, areas, projects, tasks } from "./index.js";

const now = new Date().toISOString();
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function seed() {
  // Clear existing data
  await db.delete(tasks);
  await db.delete(projects);
  await db.delete(areas);

  // Areas
  const [workArea] = await db
    .insert(areas)
    .values({ id: nanoid(), name: "Work", color: "#4f46e5", position: 1, createdAt: now, updatedAt: now })
    .returning();

  const [personalArea] = await db
    .insert(areas)
    .values({ id: nanoid(), name: "Personal", color: "#059669", position: 2, createdAt: now, updatedAt: now })
    .returning();

  // Projects
  const [launchProject] = await db
    .insert(projects)
    .values({
      id: nanoid(),
      name: "App Launch",
      areaId: workArea!.id,
      position: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Tasks
  await db.insert(tasks).values([
    // Inbox task
    {
      id: nanoid(),
      title: "Review design mockups",
      position: 1,
      createdAt: now,
      updatedAt: now,
    },
    // Today task
    {
      id: nanoid(),
      title: "Team standup",
      whenDate: today,
      timeOfDay: "morning",
      projectId: launchProject!.id,
      position: 1,
      createdAt: now,
      updatedAt: now,
    },
    // Upcoming task with deadline
    {
      id: nanoid(),
      title: "Submit app to App Store",
      whenDate: tomorrow,
      deadline: tomorrow,
      projectId: launchProject!.id,
      position: 2,
      createdAt: now,
      updatedAt: now,
    },
    // Recurring task
    {
      id: nanoid(),
      title: "Weekly review",
      whenDate: today,
      timeOfDay: "day",
      areaId: personalArea!.id,
      recurrenceType: "weekly",
      recurrenceMode: "on_schedule",
      recurrenceInterval: 1,
      position: 3,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
