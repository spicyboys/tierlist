import { test, expect, Page } from "@playwright/test";

async function registerUser(page: Page) {
  const email = `test-${Date.now()}@example.com`;
  await page.goto("/auth/register");
  await page.waitForSelector('input[placeholder="Your name"]');
  await page.fill('input[placeholder="Your name"]', "TestUser");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard", { timeout: 10000 });
}

test.describe("Live session same-tier reordering", () => {
  test("items stay reordered within the same tier during a live session", async ({
    page,
  }) => {
    test.setTimeout(90000);

    // Register and login
    await registerUser(page);

    // Navigate to new editor
    await page.goto("/editor/new");
    await page.waitForSelector("text=+ Add Item", { timeout: 10000 });

    // Add 3 items to unsorted pool
    for (const name of ["Alpha", "Beta", "Gamma"]) {
      await page.click("text=+ Add Item");
      await page.waitForSelector("input[placeholder='Item title']");
      await page.fill("input[placeholder='Item title']", name);
      await page.locator("button:has-text('Add Item')").last().click();
      await page.waitForTimeout(300);
    }

    // Wait for items to appear
    await expect(page.locator("text=Alpha").first()).toBeVisible();
    await expect(page.locator("text=Beta").first()).toBeVisible();
    await expect(page.locator("text=Gamma").first()).toBeVisible();

    // Drag items to the S tier
    // Use the droppable zone inside the first tier row
    const firstTierRow = page.locator('[class*="flex items-stretch"]').first();
    const dropZone = firstTierRow.locator('[class*="flex-1"]');

    for (const name of ["Alpha", "Beta", "Gamma"]) {
      const item = page.locator(`[class*="cursor-grab"]:has-text("${name}")`).first();
      await item.dragTo(dropZone);
      await page.waitForTimeout(500);
    }

    // Verify items are in the S tier
    await expect(firstTierRow.locator("text=Alpha")).toBeVisible({ timeout: 3000 });
    await expect(firstTierRow.locator("text=Beta")).toBeVisible({ timeout: 3000 });
    await expect(firstTierRow.locator("text=Gamma")).toBeVisible({ timeout: 3000 });

    // Save the tier list (this creates it in the DB)
    await page.click("button:has-text('Save')");
    await page.waitForTimeout(2000);

    // Start a live session
    const startBtn = page.locator("button:has-text('Start Live Session')");
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();

    // Wait for live code to appear
    await expect(page.locator("[class*='font-mono']").first()).toBeVisible({
      timeout: 10000,
    });
    // Let polling stabilize
    await page.waitForTimeout(3000);

    // Get items in the S tier
    const getItemOrder = async () => {
      const items = firstTierRow.locator('[class*="cursor-grab"], [class*="w-[80px]"]');
      const count = await items.count();
      const texts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await items.nth(i).textContent();
        if (text) {
          const clean = text.replace(/[✎x]/g, "").trim();
          if (clean && ["Alpha", "Beta", "Gamma"].some(n => clean.includes(n))) {
            texts.push(clean);
          }
        }
      }
      return texts;
    };

    const orderBefore = await getItemOrder();
    console.log("Order before drag:", orderBefore);

    // Drag Gamma to before Alpha
    const gamma = firstTierRow.locator('[class*="cursor-grab"]:has-text("Gamma")').first();
    const alpha = firstTierRow.locator('[class*="cursor-grab"]:has-text("Alpha")').first();

    // Use manual mouse-based drag for more control
    const gammaBox = await gamma.boundingBox();
    const alphaBox = await alpha.boundingBox();

    if (gammaBox && alphaBox) {
      await page.mouse.move(gammaBox.x + gammaBox.width / 2, gammaBox.y + gammaBox.height / 2);
      await page.mouse.down();
      // Move to left edge of Alpha to place before it
      await page.mouse.move(alphaBox.x + 5, alphaBox.y + alphaBox.height / 2, { steps: 10 });
      await page.waitForTimeout(200);
      await page.mouse.up();
    }

    // Wait for the move to process
    await page.waitForTimeout(3000);

    const orderAfter = await getItemOrder();
    console.log("Order after drag:", orderAfter);

    // Gamma should now be before Alpha
    const gammaIdx = orderAfter.findIndex((s) => s.includes("Gamma"));
    const alphaIdx = orderAfter.findIndex((s) => s.includes("Alpha"));

    console.log(`Gamma at index ${gammaIdx}, Alpha at index ${alphaIdx}`);
    expect(gammaIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(gammaIdx).toBeLessThan(alphaIdx);

    // Wait another 3 seconds to verify no stale polls revert the order
    await page.waitForTimeout(3000);

    const orderFinal = await getItemOrder();
    console.log("Final order (after more polls):", orderFinal);

    const gammaIdxFinal = orderFinal.findIndex((s) => s.includes("Gamma"));
    const alphaIdxFinal = orderFinal.findIndex((s) => s.includes("Alpha"));
    expect(gammaIdxFinal).toBeLessThan(alphaIdxFinal);
  });
});
