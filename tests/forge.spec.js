const { test, expect } = require('@playwright/test');

const PHASES = [
  ['p1', 'Aggressive Cut', 2380],
  ['p2', 'Cut + Hypertrophy', 2470],
  ['p3', 'Diet Break', 2835],
  ['p4', 'Moderate Cut', 2470],
  ['p5', 'Slow Cut', 2600],
  ['p6', 'Mini Bulk', 2960],
  ['p7', 'Recomposition', 2835]
];

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

async function noHorizontalScroll(page) {
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(sw, 'page must not scroll sideways').toBeLessThanOrEqual(w + 1);
}

test.describe('App', () => {
  test('loader shows glowing FORGE bottom-right, then goes away', async ({ page }) => {
    await page.goto('./');
    const logo = page.locator('#loaderLogoText');
    if (await logo.count()) {
      await expect(logo).toHaveText('FORGE');
      const box = await logo.boundingBox();
      const vp = page.viewportSize();
      if (box) {
        expect(box.x + box.width).toBeGreaterThan(vp.width * 0.6);
        expect(box.y + box.height).toBeGreaterThan(vp.height * 0.8);
      }
    }
    await expect(page.locator('#forgeLoader')).toHaveCount(0, { timeout: 6000 });
  });

  test('loads with no JavaScript errors', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('./');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('no sideways scroll', async ({ page }) => {
    await page.goto('./');
    await page.waitForLoadState('load');
    await noHorizontalScroll(page);
  });

  test('Pull day has Hang Power Clean', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.ex-name', { hasText: 'Hang Power Clean' }).first()).toBeAttached();
  });

  test('first visit shows welcome, closes on backdrop tap', async ({ page }) => {
    await page.goto('./');
    const modal = page.locator('#welcomeModal');
    await expect(modal).toHaveClass(/open/, { timeout: 6000 });
    await page.locator('#welcomeModal .modal-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(modal).not.toHaveClass(/open/);
    expect(await page.evaluate(() => localStorage.getItem('forge_welcomed'))).toBe('1');
  });

  test('Fuel tab: 7 phases, totals match targets', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('forge_welcomed', '1'));
    await page.goto('./#nutrition');
    await expect(page.locator('#forgeLoader')).toHaveCount(0, { timeout: 6000 });
    const tabs = page.locator('.mtab');
    await expect(tabs).toHaveCount(7);
    for (const [id, name, kcal] of PHASES) {
      await page.locator(`.mtab[data-macro="${id}"]`).click();
      await expect(page.locator('#mealPlanLabel')).toContainText(name);
      const totals = await page.locator('#dailyTotals').innerText();
      expect(totals).toContain(`DAILY TOTAL: ${kcal} kcal`);
      expect(totals).toContain(`Target: ${kcal} kcal`);
    }
  });

  test('Fuel tab links to diet chart', async ({ page }) => {
    await page.goto('./');
    const href = await page.locator('a[href="diet.html"]').first().getAttribute('href');
    expect(href).toBe('diet.html');
  });

  test('PWA files are served', async ({ request }) => {
    for (const p of ['manifest.json', 'sw.js', 'icons/icon-192.png', 'icons/apple-touch-icon.png']) {
      const r = await request.get(p);
      expect(r.status(), p).toBe(200);
    }
    const m = await (await request.get('manifest.json')).json();
    expect(m.start_url).toBe('./');
  });
});

test.describe('Diet chart', () => {
  test('loads clean, no sideways scroll', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('diet.html');
    await expect(page.locator('.phase-tab')).toHaveCount(7);
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  });

  test('every phase tab shows the right calories', async ({ page }) => {
    await page.goto('diet.html');
    for (const [id, name, kcal] of PHASES) {
      await page.locator(`.phase-tab[data-id="${id}"]`).click();
      await expect(page.locator('.phase-head h2')).toContainText(name);
      await expect(page.locator('.stat-card .val').first()).toHaveText(kcal.toLocaleString('en-US'));
      await noHorizontalScroll(page);
    }
  });

  test('deep link #p6 opens Mini Bulk', async ({ page }) => {
    await page.goto('diet.html#p6');
    await expect(page.locator('.phase-head h2')).toContainText('Mini Bulk');
  });

  test('no isabgol or dosakaya anywhere', async ({ page }) => {
    await page.goto('diet.html');
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text).not.toContain('isabgol');
    expect(text).not.toContain('dosakaya');
  });

  test('recipes expand on tap', async ({ page }) => {
    await page.goto('diet.html');
    const first = page.locator('details.recipe').first();
    await expect(first.locator('.recipe-body')).toBeHidden();
    await first.locator('summary').click();
    await expect(first.locator('.recipe-body')).toBeVisible();
  });

  test('back link returns to the app', async ({ page }) => {
    await page.goto('diet.html');
    await page.locator('.topbar a').click();
    await expect(page).toHaveTitle(/FORGE/);
    await expect(page.locator('#nutrition')).toBeAttached();
  });
});

test.describe('Phone feel (mobile-native + calm motion)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('forge_welcomed', '1'));
  });

  test('inputs are 16px+ on touch so iOS never zooms', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    await page.goto('./');
    const small = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
      .filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => el.id || el.className));
    expect(small).toEqual([]);
  });

  test('every :hover style is limited to real mouse devices', async ({ page }) => {
    await page.goto('./');
    const ungated = await page.evaluate(() => {
      let n = 0;
      const walk = (rules, gated) => { for (const r of rules) { if (r.cssRules && r.conditionText !== undefined) walk(r.cssRules, gated || /hover:\s*hover/.test(r.conditionText)); else if (r.selectorText && r.selectorText.includes(':hover') && !gated) n++; } };
      for (const ss of document.styleSheets) { try { walk(ss.cssRules, false); } catch (e) {} }
      return n;
    });
    expect(ungated).toBe(0);
  });

  test('no endless decorative animations on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch only');
    await page.goto('./');
    await expect(page.locator('#forgeLoader')).toHaveCount(0, { timeout: 6000 });
    const loops = await page.evaluate(() => document.getAnimations()
      .filter(a => a.playState === 'running' && a.effect?.getTiming?.().iterations === Infinity)
      .map(a => a.animationName).filter(n => n !== 'ticker'));
    expect(loops).toEqual([]);
  });

  test('snow + particles stop once you scroll past the hero', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => document.getElementById('tracker').scrollIntoView());
    await expect(page.locator('html')).toHaveClass(/forge-still/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('html')).not.toHaveClass(/forge-still/);
  });

  test('session cards: LOG button and set check fit on screen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await page.goto('./');
    await expect(page.locator('#forgeLoader')).toHaveCount(0, { timeout: 6000 });
    await page.locator('#pull .sb-hdr').click();
    const row = page.locator('#pull .ex-table tbody tr', { hasText: 'Hang Power Clean' });
    await row.scrollIntoViewIfNeeded();
    const vw = page.viewportSize().width;
    for (const sel of ['.log-quick-btn', '.ex-check']) {
      const box = await row.locator(sel).boundingBox();
      expect(box, sel).not.toBeNull();
      expect(box.x + box.width, sel).toBeLessThanOrEqual(vw);
    }
    await noHorizontalScroll(page);
  });

  test('tapping a phase tab on phones keeps page width', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await page.goto('./#nutrition');
    await expect(page.locator('#forgeLoader')).toHaveCount(0, { timeout: 6000 });
    await page.locator('.mtab[data-macro="p7"]').click();
    await expect(page.locator('#mealPlanLabel')).toContainText('Recomposition');
    await noHorizontalScroll(page);
  });
});
