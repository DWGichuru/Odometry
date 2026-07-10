import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const connectionString = `${process.env.DIRECT_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const TEST_EMAIL = "pw-test@odometry.dev";
const TEST_PASSWORD = "testpass123";
const EMPTY_EMAIL = "pw-empty@odometry.dev";
const EMPTY_PASSWORD = "testpass123";

async function seed() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: TEST_EMAIL }, { email: EMPTY_EMAIL }] },
  });
  if (existing) {
    console.log("Test users already exist.");
    await prisma.$disconnect();
    return;
  }

  const trialEnd = new Date();
  trialEnd.setMonth(trialEnd.getMonth() + 1);

  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: "Playwright Test",
      currency: "USD",
      credential: {
        create: { hashedPassword: await bcrypt.hash(TEST_PASSWORD, 10) },
      },
      subscription: {
        create: {
          freeTrialEndsAt: trialEnd,
          status: "trialing",
        },
      },
      shifts: {
        create: [
          {
            date: new Date("2025-07-07"),
            platform: "UBER",
            startTime: new Date("2025-07-07T17:00:00Z"),
            endTime: new Date("2025-07-07T21:00:00Z"),
            amountEarned: 120,
            tripsCompleted: 8,
            startOdometer: 1000,
            endOdometer: 1060,
            distanceKm: 60,
            entrySource: "MANUAL",
          },
          {
            date: new Date("2025-07-08"),
            platform: "UBER",
            startTime: new Date("2025-07-08T17:00:00Z"),
            endTime: new Date("2025-07-08T22:00:00Z"),
            amountEarned: 150,
            tripsCompleted: 10,
            startOdometer: 1060,
            endOdometer: 1130,
            distanceKm: 70,
            entrySource: "MANUAL",
          },
          {
            date: new Date("2025-07-14"),
            platform: "LYFT",
            startTime: new Date("2025-07-14T18:00:00Z"),
            endTime: new Date("2025-07-14T23:00:00Z"),
            amountEarned: 200,
            tripsCompleted: 12,
            startOdometer: 1130,
            endOdometer: 1220,
            distanceKm: 90,
            entrySource: "MANUAL",
          },
          {
            date: new Date("2025-07-15"),
            platform: "DOORDASH",
            startTime: new Date("2025-07-15T11:00:00Z"),
            endTime: new Date("2025-07-15T14:00:00Z"),
            amountEarned: 80,
            tripsCompleted: 6,
            startOdometer: 1220,
            endOdometer: 1260,
            distanceKm: 40,
            entrySource: "MANUAL",
          },
          {
            date: new Date("2025-07-21"),
            platform: "UBER",
            startTime: new Date("2025-07-21T08:00:00Z"),
            endTime: new Date("2025-07-21T12:00:00Z"),
            amountEarned: 180,
            tripsCompleted: 9,
            startOdometer: 1260,
            endOdometer: 1330,
            distanceKm: 70,
            entrySource: "MANUAL",
          },
          {
            date: new Date("2025-07-22"),
            platform: "LYFT",
            startTime: new Date("2025-07-22T17:00:00Z"),
            endTime: new Date("2025-07-22T21:30:00Z"),
            amountEarned: 160,
            tripsCompleted: 7,
            startOdometer: 1330,
            endOdometer: 1400,
            distanceKm: 70,
            entrySource: "MANUAL",
          },
        ],
      },
    },
  });

  console.log("Test user created:", TEST_EMAIL);

  await prisma.user.create({
    data: {
      email: EMPTY_EMAIL,
      name: "Empty User",
      currency: "USD",
      credential: {
        create: { hashedPassword: await bcrypt.hash(EMPTY_PASSWORD, 10) },
      },
      subscription: {
        create: {
          freeTrialEndsAt: trialEnd,
          status: "trialing",
        },
      },
    },
  });

  console.log("Empty user created:", EMPTY_EMAIL);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
