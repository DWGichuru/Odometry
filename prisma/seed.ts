import { prisma } from "../lib/prisma";

const TEST_USER_ID = "seed-user-001";

async function seed() {
  const existing = await prisma.user.findUnique({
    where: { id: TEST_USER_ID },
  });
  if (existing) {
    console.log("Seed data already exists. Skipping.");
    return;
  }

  const trialEnd = new Date();
  trialEnd.setMonth(trialEnd.getMonth() + 1);

  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      name: "Demo Driver",
      email: "demo@shiftrecorder.dev",
      currency: "USD",
      credential: {
        create: {
          hashedPassword: "not-a-real-hash",
        },
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
            date: new Date("2025-07-08"),
            platform: "UBER",
            startTime: new Date("2025-07-08T17:30:00"),
            endTime: new Date("2025-07-08T21:45:00"),
            amountEarned: 182.0,
            tripsCompleted: 14,
            startOdometer: 45128,
            endOdometer: 45256,
            distanceKm: 128,
            entrySource: "MANUAL",
          },
          {
            date: new Date("2025-07-07"),
            platform: "DOORDASH",
            startTime: new Date("2025-07-07T11:00:00"),
            endTime: new Date("2025-07-07T14:30:00"),
            amountEarned: 104.5,
            tripsCompleted: 12,
            startOdometer: 45060,
            endOdometer: 45128,
            distanceKm: 68,
            entrySource: "MANUAL",
          },
          {
            date: new Date("2025-07-06"),
            platform: "LYFT",
            startTime: new Date("2025-07-06T18:00:00"),
            endTime: new Date("2025-07-06T23:30:00"),
            amountEarned: 186.0,
            tripsCompleted: 11,
            startOdometer: 44914,
            endOdometer: 45060,
            distanceKm: 146,
            entrySource: "MANUAL",
          },
        ],
      },
    },
  });

  console.log("Seed data created: 1 user + 3 shifts.");
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
