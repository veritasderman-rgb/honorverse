/**
 * Mobilní smoke test (Playwright + Chromium, dotyková emulace).
 * Ověřuje: výzvu k otočení v portrétu, výsuvné šuplíky HUD na telefonu,
 * pinch-zoom na plotu (syntetické pointer eventy), klasický HUD na tabletu.
 * Spuštění: node scripts/mobile-smoke.mjs  (vyžaduje nainstalovaný playwright
 * nebo globální instalaci; screenshoty ukládá do scripts/out/).
 */
import { mkdirSync } from 'node:fs'
import { createServer } from 'vite'

const pw = await (async () => {
  try { return await import('playwright') } catch {
    return import('/opt/node22/lib/node_modules/playwright/index.mjs')
  }
})()

const OUT = new URL('./out/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const server = await createServer({ server: { port: 5197 } })
await server.listen()
const browser = await pw.chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})

let failures = 0
const check = (name, ok) => {
  console.log(`${ok ? '✓' : '×'} ${name}`)
  if (!ok) failures++
}

/** otevře misi 1 a odklikne briefing (START) */
async function openMission(page) {
  await page.goto('http://localhost:5197/?mission=mission01')
  await page.waitForTimeout(2000)
  const start = page.locator('#btn-start')
  if (await start.count() > 0) await start.tap()
  await page.waitForTimeout(500)
}

// ---------- telefon, na šířku (iPhone 14 landscape) ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true,
    deviceScaleFactor: 3,
  })
  const page = await ctx.newPage()
  await openMission(page)

  check('telefon/šířka: výzva k otočení je skrytá',
    !(await page.locator('#rotate-hint').isVisible()))
  check('telefon: záložky šuplíků ◧/◨ jsou vidět',
    await page.locator('#tab-tl').isVisible() && await page.locator('#tab-tr').isVisible())

  // šuplík vlevo: otevřít → třída open; otevření pravého levý zavře
  await page.locator('#tab-tl').tap()
  await page.waitForTimeout(300)
  check('šuplík vlevo se otevře (loď + flotila)',
    await page.locator('#hud-tl.open').count() === 1)
  await page.locator('#tab-tr').tap()
  await page.waitForTimeout(300)
  check('šuplík vpravo otevřen, levý se zavřel',
    await page.locator('#hud-tr.open').count() === 1
    && await page.locator('#hud-tl.open').count() === 0)
  await page.locator('#tab-tr').tap()
  await page.waitForTimeout(200)

  // pinch-zoom: syntetické pointer eventy na canvasu, čtení přes __wob hook
  const zooms = await page.evaluate(() => {
    const canvas = document.getElementById('plot')
    const before = window.__wob.plot.zoom
    const fire = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType: 'touch', clientX: x, clientY: y,
      bubbles: true, isPrimary: id === 1,
    }))
    fire('pointerdown', 1, 380, 195)
    fire('pointerdown', 2, 460, 195)   // dva prsty 80 px od sebe
    fire('pointermove', 1, 300, 195)
    fire('pointermove', 2, 540, 195)   // roztažení na 240 px
    const mid = window.__wob.plot.zoom
    fire('pointerup', 1, 300, 195)
    fire('pointerup', 2, 540, 195)
    return { before, mid }
  })
  check(`pinch-zoom přibližuje (${Math.round(zooms.before)} → ${Math.round(zooms.mid)} km/px)`,
    zooms.mid < zooms.before)

  await page.screenshot({ path: `${OUT}phone-landscape.png` })
  await ctx.close()
}

// ---------- telefon, na výšku: výzva k otočení ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5197/?mission=mission01')
  await page.waitForTimeout(1500)
  check('telefon/výška: výzva „otočte zařízení" je vidět',
    await page.locator('#rotate-hint').isVisible())
  await page.screenshot({ path: `${OUT}phone-portrait.png` })
  await ctx.close()
}

// ---------- tablet, na šířku: klasický HUD bez šuplíků ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 1180, height: 820 }, hasTouch: true,
  })
  const page = await ctx.newPage()
  await openMission(page)
  check('tablet: záložky šuplíků skryté (klasický HUD)',
    !(await page.locator('#tab-tl').isVisible()))
  check('tablet: HUD sloupce viditelné bez šuplíků',
    await page.locator('#hud-tl .panel').first().isVisible())
  await page.screenshot({ path: `${OUT}tablet.png` })
  await ctx.close()
}

await browser.close()
await server.close()
console.log(failures === 0 ? '\nMOBILNÍ SMOKE: vše OK' : `\nMOBILNÍ SMOKE: ${failures} selhání`)
process.exit(failures === 0 ? 0 : 1)
