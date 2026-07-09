import { execSync } from "child_process";

export default function globalSetup() {
  execSync("npx tsx tests/seed.ts", { stdio: "inherit" });
}
