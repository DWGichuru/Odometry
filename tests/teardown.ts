import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = `${process.env.DIRECT_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const TEST_EMAIL = "pw-test@gigwise.dev";
const EMPTY_EMAIL = "pw-empty@gigwise.dev";

async function teardown() {
  for (const email of [TEST_EMAIL, EMPTY_EMAIL]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.user.delete({ where: { email } });
      console.log("Test user cleaned up:", email);
    }
  }
  await prisma.$disconnect();
}

teardown().catch((e) => {
  console.error(e);
  process.exit(1);
});
