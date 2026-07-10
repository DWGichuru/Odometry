import { test, expect } from "@playwright/test";

const TEST_EMAIL = "pw-test@gigwise.dev";
const TEST_PASSWORD = "testpass123";
const EMPTY_EMAIL = "pw-empty@gigwise.dev";

async function signIn(page: ReturnType<typeof test["info"]>["page"]) {
  await page.goto("/sign-in");
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 10000 });
}

test.describe("Trends page - unauthenticated", () => {
  test("redirects to sign-in when not logged in", async ({ page }) => {
    await page.goto("/trends");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("Trends page - authenticated", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("renders page with header and period toggle", async ({ page }) => {
    await page.goto("/trends");
    await expect(page.locator("h1")).toContainText("Trends");
    await expect(page.locator(".pill-toggle")).toBeVisible();
    await expect(page.locator(".pill-toggle a.active")).toContainText("Week");
  });

  test("switches to month view via pill toggle", async ({ page }) => {
    await page.goto("/trends");
    await page.click(".pill-toggle a:has-text('Month')");
    await expect(page).toHaveURL(/period=month/);
    await expect(page.locator(".pill-toggle a.active")).toContainText("Month");
  });

  test("renders both chart cards", async ({ page }) => {
    await page.goto("/trends");
    await expect(page.getByText("Your rates")).toBeVisible();
    await expect(page.getByText("Totals")).toBeVisible();
  });

  test("totals chart has earnings and hours visible by default", async ({ page }) => {
    await page.goto("/trends");
    const totalsSection = page.locator("section").filter({ hasText: "Totals" });
    await expect(totalsSection.locator('.chip[aria-pressed="true"]:has-text("Earnings")')).toBeVisible();
    await expect(totalsSection.locator('.chip[aria-pressed="true"]:has-text("Hours")')).toBeVisible();
  });

  test("rates chart has all three series visible by default", async ({ page }) => {
    await page.goto("/trends");
    const ratesSection = page.locator("section").filter({ hasText: "Your rates" });
    await expect(ratesSection.locator('.chip[aria-pressed="true"]')).toHaveCount(3);
  });

  test("legend chip toggles series visibility", async ({ page }) => {
    await page.goto("/trends");
    const totalsSection = page.locator("section").filter({ hasText: "Totals" });
    const tripsChip = totalsSection.locator('.chip:has-text("Trips")');
    await expect(tripsChip).toHaveAttribute("aria-pressed", "false");
    await tripsChip.click();
    await expect(tripsChip).toHaveAttribute("aria-pressed", "true");
    await tripsChip.click();
    await expect(tripsChip).toHaveAttribute("aria-pressed", "false");
  });

  test("chart tooltip appears on hover", async ({ page }) => {
    await page.goto("/trends");
    const chart = page.locator(".chart svg").first();
    await chart.hover({ position: { x: 200, y: 100 } });
    await expect(page.locator(".chart-tip.show")).toBeVisible();
  });

  test("tooltip shows period label and series values", async ({ page }) => {
    await page.goto("/trends");
    const chart = page.locator(".chart svg").first();
    await chart.hover({ position: { x: 200, y: 100 } });
    const tip = page.locator(".chart-tip.show");
    await expect(tip.locator(".tip-period")).toBeVisible();
    await expect(tip.locator(".tip-row")).not.toHaveCount(0);
  });

  test("tooltip hides on mouse leave", async ({ page }) => {
    await page.goto("/trends");
    const chart = page.locator(".chart svg").first();
    await chart.hover({ position: { x: 200, y: 100 } });
    await expect(page.locator(".chart-tip.show")).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.locator(".chart-tip.show")).not.toBeVisible();
  });

  test("bottom nav shows Trends tab as active", async ({ page }) => {
    await page.goto("/trends");
    const trendsTab = page.locator("nav a").filter({ hasText: "Trends" });
    await expect(trendsTab).toBeVisible();
    await expect(trendsTab).toHaveClass(/text-accent/);
  });

  test("navigates from bottom nav Trends tab", async ({ page }) => {
    await page.goto("/dashboard");
    await page.click("nav a:has-text('Trends')");
    await expect(page).toHaveURL("/trends");
    await expect(page.locator("h1")).toContainText("Trends");
  });

  test("SVG charts render with correct viewBox", async ({ page }) => {
    await page.goto("/trends");
    const svgs = page.locator(".chart svg");
    await expect(svgs).toHaveCount(2);
    await expect(svgs.first()).toHaveAttribute("viewBox", "0 0 400 200");
  });
});

test.describe("Trends page - empty state", () => {
  test("shows empty state for user with no shifts", async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill('input[name="email"]', EMPTY_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    await page.goto("/trends");
    await expect(page.getByText("No shifts yet.")).toBeVisible();
    await expect(page.getByText("Log a shift")).toBeVisible();
    await expect(page.locator(".chart")).toHaveCount(0);
  });
});
