/**
 * Mobilní ovládání: pinch-zoom matematika (čistá funkce z plot.ts)
 * a kontrola PWA artefaktů (manifest, service worker, ikony).
 */
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pinchZoom } from '../src/ui/plot'

describe('pinchZoom — pinch gesto na plotu', () => {
  it('roztažení prstů přibližuje (méně km/px), sevření oddaluje', () => {
    expect(pinchZoom(20_000, 100, 200)).toBeCloseTo(10_000)
    expect(pinchZoom(20_000, 200, 100)).toBeCloseTo(40_000)
  })

  it('drží meze zoomu (50 až 500 000 km/px)', () => {
    expect(pinchZoom(100, 10, 1000)).toBe(50)
    expect(pinchZoom(400_000, 1000, 10)).toBe(500_000)
  })

  it('nulová/záporná vzdálenost prstů měřítko nemění', () => {
    expect(pinchZoom(20_000, 0, 150)).toBe(20_000)
    expect(pinchZoom(20_000, 150, 0)).toBe(20_000)
  })

  it('poměrová symetrie: pinch tam a zpět vrací původní měřítko', () => {
    const z = pinchZoom(pinchZoom(20_000, 100, 173), 173, 100)
    expect(z).toBeCloseTo(20_000)
  })
})

describe('PWA artefakty', () => {
  it('manifest je validní JSON s ikonami a landscape orientací', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
      name: string; orientation: string; display: string
      icons: { src: string; sizes: string }[]
    }
    expect(m.name).toBe('Wall of Battle')
    expect(m.orientation).toBe('landscape')
    expect(m.display).toBe('fullscreen')
    expect(m.icons.length).toBeGreaterThanOrEqual(2)
    for (const icon of m.icons) {
      expect(existsSync(`public${icon.src}`)).toBe(true)
    }
  })

  it('service worker existuje a index na něj i manifest odkazuje', () => {
    expect(existsSync('public/sw.js')).toBe(true)
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain('manifest.webmanifest')
    expect(html).toContain('viewport-fit=cover')
    expect(html).toContain('touch-action: none')
    expect(html).toContain('rotate-hint')
  })
})

describe('iPad / tablet optimalizace', () => {
  it('main.ts detekuje tablet (hrubý pointer + velká krátká strana) a přepíná body.tablet', () => {
    const main = readFileSync('src/main.ts', 'utf8')
    expect(main).toContain('detectTablet')
    expect(main).toContain("classList.toggle('tablet'")
    // tablet je z rozměru/media, phone drží ruční override — obojí se přehodnotí
    expect(main).toContain('applyDeviceClasses')
  })

  it('index.html má dotykové cíle pro body.tablet a nudge do landscape i pro velké tablety', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain('body.tablet button')
    expect(html).toContain('body.tablet:not(.phone)')
    expect(html).toContain('body.tablet.phone')
    // rotate-hint pokrývá i iPad Pro 12,9" na výšku (1024 px)
    expect(html).toContain('max-width: 1100px')
  })
})
