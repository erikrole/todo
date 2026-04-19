/**
 * Dev seed — run with: pnpm db:seed -- --confirm
 * Requires --confirm flag to prevent accidental data loss.
 */
import { nanoid } from "nanoid";
import { db, areas, projects, tasks, logs, logEntries, subscriptions, occasions } from "./index.js";

if (!process.argv.includes("--confirm")) {
  console.error("⚠️  This will DELETE all data. Run with --confirm to proceed.");
  console.error("   pnpm db:seed -- --confirm");
  process.exit(1);
}

const now = new Date().toISOString();
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

async function seed() {
  // Clear existing data (order matters for FK constraints)
  await db.delete(logEntries);
  await db.delete(logs);
  await db.delete(subscriptions);
  await db.delete(occasions);
  await db.delete(tasks);
  await db.delete(projects);
  await db.delete(areas);

  // ── Areas ──────────────────────────────────────────────────────────────────

  const [workArea] = await db
    .insert(areas)
    .values({ id: nanoid(), name: "Work", color: "#4f46e5", position: 1, createdAt: now, updatedAt: now })
    .returning();

  const [personalArea] = await db
    .insert(areas)
    .values({ id: nanoid(), name: "Personal", color: "#059669", position: 2, createdAt: now, updatedAt: now })
    .returning();

  const [homeArea] = await db
    .insert(areas)
    .values({ id: nanoid(), name: "Home", color: "#d97706", position: 3, createdAt: now, updatedAt: now })
    .returning();

  // ── Projects ───────────────────────────────────────────────────────────────

  const [errandsProject] = await db
    .insert(projects)
    .values({
      id: nanoid(),
      name: "Errands",
      areaId: personalArea!.id,
      position: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [lawnCareProject] = await db
    .insert(projects)
    .values({
      id: nanoid(),
      name: "Lawn Care",
      areaId: homeArea!.id,
      position: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [appLaunchProject] = await db
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

  // ── Tasks ──────────────────────────────────────────────────────────────────

  await db.insert(tasks).values([
    // Inbox
    { id: nanoid(), title: "Review design mockups", position: 1, createdAt: now, updatedAt: now },
    // Today — work
    {
      id: nanoid(),
      title: "Team standup",
      whenDate: today,
      timeOfDay: "morning",
      projectId: appLaunchProject!.id,
      position: 1,
      createdAt: now,
      updatedAt: now,
    },
    // Upcoming — work
    {
      id: nanoid(),
      title: "Submit app to App Store",
      whenDate: tomorrow,
      deadline: tomorrow,
      projectId: appLaunchProject!.id,
      position: 2,
      createdAt: now,
      updatedAt: now,
    },
    // Recurring — personal
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
    // Errands project tasks
    { id: nanoid(), title: "Pick up dry cleaning", projectId: errandsProject!.id, whenDate: today, position: 1, createdAt: now, updatedAt: now },
    { id: nanoid(), title: "Return Amazon package", projectId: errandsProject!.id, position: 2, createdAt: now, updatedAt: now },
    // Lawn care tasks
    { id: nanoid(), title: "Sharpen mower blade", projectId: lawnCareProject!.id, position: 1, createdAt: now, updatedAt: now },
    { id: nanoid(), title: "Buy fertilizer for spring", projectId: lawnCareProject!.id, position: 2, createdAt: now, updatedAt: now },
  ]);

  // ── Logs ───────────────────────────────────────────────────────────────────

  const [gasLog] = await db
    .insert(logs)
    .values({
      id: nanoid(),
      name: "Gas",
      slug: "gas",
      description: "Fuel fill-ups and mileage tracking",
      icon: "⛽",
      color: "#f59e0b",
      isBuiltIn: true,
      position: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [mowingLog] = await db
    .insert(logs)
    .values({
      id: nanoid(),
      name: "Mowing",
      slug: "mowing",
      description: "Lawn mowing sessions and maintenance",
      icon: "🌿",
      color: "#10b981",
      isBuiltIn: true,
      position: 2,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Gas entries — last 6 fill-ups
  const gasFills = [
    { daysBack: 62, gallons: 11.2, pricePerGallon: 3.19, odometer: 47210, station: "Speedway", grade: "regular" },
    { daysBack: 49, gallons: 12.0, pricePerGallon: 3.25, odometer: 47560, station: "Marathon", grade: "regular" },
    { daysBack: 37, gallons: 10.8, pricePerGallon: 3.31, odometer: 47890, station: "Speedway", grade: "regular" },
    { daysBack: 24, gallons: 11.5, pricePerGallon: 3.28, odometer: 48220, station: "Shell", grade: "regular" },
    { daysBack: 12, gallons: 12.3, pricePerGallon: 3.15, odometer: 48570, station: "Costco", grade: "regular" },
    { daysBack: 2, gallons: 11.9, pricePerGallon: 3.09, odometer: 48900, station: "Costco", grade: "regular" },
  ];

  const gasOdometers = gasFills.map((f) => f.odometer);
  for (let i = 0; i < gasFills.length; i++) {
    const fill = gasFills[i]!;
    const prevOdometer = i > 0 ? gasOdometers[i - 1]! : null;
    const mpg = prevOdometer ? Math.round(((fill.odometer - prevOdometer) / fill.gallons) * 10) / 10 : null;

    await db.insert(logEntries).values({
      id: nanoid(),
      logId: gasLog!.id,
      loggedAt: daysAgo(fill.daysBack),
      numericValue: mpg,
      data: JSON.stringify({
        station: fill.station,
        gallons: fill.gallons,
        pricePerGallon: fill.pricePerGallon,
        totalCost: Math.round(fill.gallons * fill.pricePerGallon * 100) / 100,
        odometer: fill.odometer,
        grade: fill.grade,
      }),
      createdAt: now,
      updatedAt: now,
    });
  }

  // Mowing entries — last 8 mows (directions cycle N→E→S→W)
  const directions = ["North", "East", "South", "West"];
  const mowDays = [58, 47, 38, 28, 20, 13, 7, 1];
  for (let i = 0; i < mowDays.length; i++) {
    const daysBack = mowDays[i]!;
    const prevDaysBack = i > 0 ? mowDays[i - 1]! : null;
    const daysBetween = prevDaysBack ? prevDaysBack - daysBack : null;

    await db.insert(logEntries).values({
      id: nanoid(),
      logId: mowingLog!.id,
      loggedAt: daysAgo(daysBack),
      numericValue: daysBetween,
      data: JSON.stringify({
        direction: directions[i % 4],
        durationMinutes: 35 + Math.floor(Math.random() * 20),
        weather: i % 3 === 0 ? "sunny" : "cloudy",
        edged: i % 2 === 0,
        bagged: false,
      }),
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  await db.insert(subscriptions).values([
    {
      id: nanoid(),
      name: "Netflix",
      amount: 15.49,
      billingPeriod: "monthly",
      nextDueDate: daysFromNow(8),
      category: "streaming",
      autoRenew: true,
      url: "https://netflix.com",
      position: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nanoid(),
      name: "Spotify",
      amount: 10.99,
      billingPeriod: "monthly",
      nextDueDate: daysFromNow(14),
      category: "streaming",
      autoRenew: true,
      url: "https://spotify.com",
      position: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nanoid(),
      name: "iCloud+",
      amount: 2.99,
      billingPeriod: "monthly",
      nextDueDate: daysFromNow(3),
      category: "storage",
      autoRenew: true,
      url: "https://apple.com/icloud",
      position: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nanoid(),
      name: "YouTube Premium",
      amount: 13.99,
      billingPeriod: "monthly",
      nextDueDate: daysFromNow(21),
      category: "streaming",
      autoRenew: true,
      position: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nanoid(),
      name: "1Password",
      amount: 35.88,
      billingPeriod: "annual",
      nextDueDate: daysFromNow(142),
      category: "software",
      autoRenew: true,
      url: "https://1password.com",
      position: 5,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // ── Occasions ──────────────────────────────────────────────────────────────

  await db.insert(occasions).values([
    {
      id: nanoid(),
      name: "Mom's Birthday",
      date: `${new Date().getFullYear()}-06-12`,
      isAnnual: true,
      prepWindowDays: 14,
      emoji: "🎂",
      position: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nanoid(),
      name: "Wedding Anniversary",
      date: `${new Date().getFullYear()}-08-03`,
      isAnnual: true,
      prepWindowDays: 30,
      emoji: "💍",
      position: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: nanoid(),
      name: "Dad's Birthday",
      date: `${new Date().getFullYear()}-09-27`,
      isAnnual: true,
      prepWindowDays: 14,
      emoji: "🎂",
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
