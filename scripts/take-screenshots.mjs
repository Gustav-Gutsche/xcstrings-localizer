// Captures the README screenshots against the local dev server (bun run dev).
// Usage: node scripts/take-screenshots.mjs
// Output: docs/screenshots/*.png (1600x1000 viewport @2x, dark theme)

import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'screenshots')
const APP_URL = 'http://localhost:5173'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// A demo .xcstrings file so the translator page shows real content
const DEMO_XCSTRINGS = {
  sourceLanguage: 'en',
  version: '1.0',
  strings: {
    'welcome.title': {
      localizations: {
        en: { stringUnit: { state: 'translated', value: 'Welcome to FitTrack' } },
        fr: { stringUnit: { state: 'translated', value: 'Bienvenue sur FitTrack' } },
        es: { stringUnit: { state: 'translated', value: 'Bienvenido a FitTrack' } },
        de: { stringUnit: { state: 'translated', value: 'Willkommen bei FitTrack' } },
        ja: { stringUnit: { state: 'translated', value: 'FitTrackへようこそ' } },
      },
    },
    'workout.start': {
      localizations: {
        en: { stringUnit: { state: 'translated', value: 'Start workout' } },
        fr: { stringUnit: { state: 'translated', value: "Démarrer l'entraînement" } },
        es: { stringUnit: { state: 'translated', value: 'Iniciar entrenamiento' } },
        de: { stringUnit: { state: 'translated', value: 'Training starten' } },
      },
    },
    'stats.calories': {
      localizations: {
        en: { stringUnit: { state: 'translated', value: '%lld calories burned' } },
        fr: { stringUnit: { state: 'translated', value: '%lld calories brûlées' } },
        ja: { stringUnit: { state: 'translated', value: '%lld キロカロリー消費' } },
      },
    },
    'goal.reached': {
      localizations: {
        en: { stringUnit: { state: 'translated', value: "You reached today's goal! 🎉" } },
        fr: { stringUnit: { state: 'translated', value: "Objectif du jour atteint ! 🎉" } },
      },
    },
    'streak.days': {
      localizations: {
        en: { stringUnit: { state: 'translated', value: '%d day streak' } },
      },
    },
    'premium.upgrade': {
      localizations: {
        en: { stringUnit: { state: 'translated', value: 'Upgrade to Premium' } },
      },
    },
  },
}

// Phone-shaped demo app screen rendered as HTML, screenshotted, then fed to the Screenshots tab
const PHONE_MOCK_HTML = `data:text/html,<html><body style="margin:0;width:660px;height:1434px;font-family:-apple-system,sans-serif;background:linear-gradient(180deg,%23101831 0%25,%23182446 100%25);color:white;overflow:hidden">
<div style="padding:90px 44px 0">
<div style="font-size:30px;opacity:.65">Good morning, Alex</div>
<div style="font-size:52px;font-weight:800;margin-top:6px">Today's Activity</div>
<div style="margin-top:48px;background:rgba(255,255,255,.08);border-radius:36px;padding:44px">
<div style="font-size:26px;opacity:.6">Calories</div>
<div style="font-size:72px;font-weight:800;color:%23ffb86b">486</div>
<div style="height:14px;background:rgba(255,255,255,.12);border-radius:7px;margin-top:22px"><div style="width:64%25;height:100%25;background:linear-gradient(90deg,%23ff9f5a,%23ffd16b);border-radius:7px"></div></div>
</div>
<div style="display:flex;gap:24px;margin-top:26px">
<div style="flex:1;background:rgba(255,255,255,.08);border-radius:36px;padding:38px"><div style="font-size:24px;opacity:.6">Steps</div><div style="font-size:54px;font-weight:800;color:%236bd3ff">9,214</div></div>
<div style="flex:1;background:rgba(255,255,255,.08);border-radius:36px;padding:38px"><div style="font-size:24px;opacity:.6">Minutes</div><div style="font-size:54px;font-weight:800;color:%23a78bfa">52</div></div>
</div>
<div style="margin-top:26px;background:linear-gradient(135deg,%234f7cff,%23a056ff);border-radius:36px;padding:44px;text-align:center;font-size:34px;font-weight:700">Start workout</div>
</div></body></html>`

async function preparePage(browser, { page: appPage, theme = 'dark' }) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })
  await page.evaluateOnNewDocument((activePage, themeValue) => {
    sessionStorage.setItem('xcstrings-localizer-welcome-shown', 'true')
    localStorage.setItem('localizer-theme', themeValue)
    localStorage.setItem('xcstrings-localizer-active-page', activePage)
  }, appPage, theme)
  await page.goto(APP_URL, { waitUntil: 'networkidle2' })
  await sleep(1200)
  return page
}

async function shoot(page, name) {
  const path = join(OUT, `${name}.png`)
  await page.screenshot({ path })
  console.log(`✓ ${name}.png`)
  await page.close()
}

// Screenshot clipped around an element (dialog, card, canvas) with padding,
// so the README shows the feature — not the whole page.
async function clipShot(page, selector, name, pad = 36) {
  const el = await page.$(selector)
  if (!el) { console.warn(`✗ ${name}: selector not found (${selector})`); await page.close(); return }
  const box = await el.boundingBox()
  if (!box) { console.warn(`✗ ${name}: element not visible (${selector})`); await page.close(); return }
  const vp = page.viewport()
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: Math.min(vp.width - Math.max(0, box.x - pad), box.width + pad * 2),
    height: Math.min(vp.height - Math.max(0, box.y - pad), box.height + pad * 2),
  }
  await page.screenshot({ path: join(OUT, `${name}.png`), clip })
  console.log(`✓ ${name}.png (feature crop)`)
  await page.close()
}

// Open a dev-only demo scenario (?demo=…) and capture its dialog
async function demoShot(browser, scenario, name) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('xcstrings-localizer-welcome-shown', 'true')
    localStorage.setItem('localizer-theme', 'dark')
  })
  await page.goto(`${APP_URL}/?demo=${scenario}`, { waitUntil: 'networkidle2' })
  await sleep(1500)
  await clipShot(page, '[role="dialog"]', name)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=2'],
})

try {
  // --- 0. Render the phone mock used by the Screenshots tab ---
  const mock = await browser.newPage()
  await mock.setViewport({ width: 660, height: 1434, deviceScaleFactor: 1 })
  await mock.goto(PHONE_MOCK_HTML)
  await sleep(300)
  const mockPath = join(OUT, '.phone-mock.png')
  await mock.screenshot({ path: mockPath })
  await mock.close()

  // Demo xcstrings on disk for the file input
  const xcPath = join(OUT, '.demo.xcstrings')
  writeFileSync(xcPath, JSON.stringify(DEMO_XCSTRINGS, null, 2))

  // --- 1. Landing page (welcome) ---
  {
    const page = await browser.newPage()
    await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('localizer-theme', 'dark')
      sessionStorage.removeItem('xcstrings-localizer-welcome-shown')
    })
    await page.goto(APP_URL, { waitUntil: 'networkidle2' })
    await sleep(1200)
    await shoot(page, 'landing')
  }

  // --- 2. XCStrings translator with the demo file loaded ---
  {
    const page = await preparePage(browser, { page: 'xcstrings' })
    const input = await page.$('input[accept=".xcstrings"]')
    if (input) {
      await input.uploadFile(xcPath)
      await sleep(1500)
      // Switch to the View & Edit tab to show the populated editor
      const tabs = await page.$$('button')
      for (const t of tabs) {
        const txt = await t.evaluate((el) => el.textContent)
        if (/View & Edit/i.test(txt)) { await t.click(); break }
      }
      await sleep(1200)
    }
    await shoot(page, 'xcstrings-editor')
  }

  // --- 3. Screenshots studio with a demo phone screenshot ---
  {
    const page = await preparePage(browser, { page: 'screenshots' })
    const fileInputs = await page.$$('input[type="file"]')
    for (const fi of fileInputs) {
      const accept = await fi.evaluate((el) => el.accept)
      if (accept?.includes('image')) { await fi.uploadFile(mockPath); break }
    }
    await sleep(2500)
    await shoot(page, 'screenshot-studio')
  }

  // --- 4. App Store Connect page ---
  {
    const page = await preparePage(browser, { page: 'appstore' })
    await shoot(page, 'app-store-connect')
  }

  // --- 5. Subscriptions pricing page (GDP Pricing tab is the showcase) ---
  {
    const page = await preparePage(browser, { page: 'subscriptions' })
    const tabs = await page.$$('button')
    for (const t of tabs) {
      const txt = await t.evaluate((el) => el.textContent)
      if (/GDP Pricing/i.test(txt)) { await t.click(); break }
    }
    await sleep(1500)
    await shoot(page, 'subscriptions')
  }

  // =====================================================================
  // Feature shots — dialogs and components in action, cropped tight
  // =====================================================================

  // --- 6. AppCompete keyword suggestions dialog ---
  await demoShot(browser, 'suggestions', 'feature-keyword-suggestions')

  // --- 7. Keyword review verdicts dialog ---
  await demoShot(browser, 'review', 'feature-keyword-review')

  // --- 8. Competitor picker dialog ---
  await demoShot(browser, 'competitors', 'feature-competitors')

  // --- 9. XCStrings translation edit dialog (real flow: load file, click a translation) ---
  {
    const page = await preparePage(browser, { page: 'xcstrings' })
    const input = await page.$('input[accept=".xcstrings"]')
    await input.uploadFile(join(OUT, '.demo.xcstrings'))
    await sleep(1500)
    for (const t of await page.$$('button')) {
      const txt = await t.evaluate((el) => el.textContent)
      if (/View & Edit/i.test(txt)) { await t.click(); break }
    }
    await sleep(1000)
    // Click the first filled translation badge to open the edit dialog
    const badges = await page.$$('table button[title]')
    for (const b of badges) {
      const title = await b.evaluate((el) => el.title)
      if (title && title !== 'Click to add translation') { await b.click(); break }
    }
    await sleep(900)
    await clipShot(page, '[role="dialog"]', 'feature-edit-translation')
  }

  // --- 10. Screenshot studio canvas close-up ---
  {
    const page = await preparePage(browser, { page: 'screenshots' })
    for (const fi of await page.$$('input[type="file"]')) {
      const accept = await fi.evaluate((el) => el.accept)
      if (accept?.includes('image')) { await fi.uploadFile(join(OUT, '.phone-mock.png')); break }
    }
    await sleep(2500)
    // Several canvases exist (hidden Three.js renderer included) — crop the largest visible one
    const target = await page.evaluateHandle(() => {
      let best = null, bestArea = 0
      for (const c of document.querySelectorAll('canvas')) {
        const r = c.getBoundingClientRect()
        if (r.width * r.height > bestArea && r.width > 0) { best = c; bestArea = r.width * r.height }
      }
      return best
    })
    const el = target.asElement()
    const box = el && (await el.boundingBox())
    if (box) {
      const pad = 60
      await page.screenshot({
        path: join(OUT, 'feature-canvas.png'),
        clip: {
          x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
          width: box.width + pad * 2, height: Math.min(1000 - Math.max(0, box.y - pad), box.height + pad * 2),
        },
      })
      console.log('✓ feature-canvas.png (feature crop)')
    }
    await page.close()
  }

  // --- 11. GDP pricing chart card close-up ---
  {
    const page = await preparePage(browser, { page: 'subscriptions' })
    for (const t of await page.$$('button')) {
      const txt = await t.evaluate((el) => el.textContent)
      if (/GDP Pricing/i.test(txt)) { await t.click(); break }
    }
    await sleep(1500)
    const card = await page.evaluateHandle(() => {
      const headers = Array.from(document.querySelectorAll('div'))
      const el = headers.find((d) => d.textContent.startsWith('Recommended Prices by Country') && d.querySelector('svg'))
      return el?.closest('[data-slot="card"], .rounded-xl, .border') || el
    })
    const box = card.asElement() && (await card.asElement().boundingBox())
    if (box) {
      await page.screenshot({
        path: join(OUT, 'feature-gdp-chart.png'),
        clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: Math.min(1000 - box.y, box.height + 20) },
      })
      console.log('✓ feature-gdp-chart.png (feature crop)')
    }
    await page.close()
  }
} finally {
  await browser.close()
}

console.log('Done.')
