import { execSync } from "child_process";

export default function globalTeardown() {
  execSync("npx tsx tests/teardown.ts", { stdio: "inherit" });
}
