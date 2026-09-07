/**
 * Google Analytics 4 s Consent Mode v2.
 *
 * Doplněk k herní telemetrii v `analytics.ts` — ta měří průchod hrou do
 * Supabase, tohle měří návštěvnost stránky. Zásady:
 * - měřicí kód jde z VITE_GA_ID; bez něj se nenačte vůbec nic,
 * - gtag.js se stahuje jen v produkčním buildu (vývoj GA nešpiní),
 * - výchozí stav souhlasu je `denied` a nastaví se PŘED gtag.js, takže než
 *   hráč klikne, GA neukládá žádné cookies (cookieless ping režim),
 * - volba se pamatuje v localStorage, lišta se pak už neukazuje.
 */
import { t } from './i18n'

const CONSENT_KEY = 'wob.cookieConsent.v1'
const GA_ID: string = import.meta.env.VITE_GA_ID ?? ''

type Choice = 'granted' | 'denied'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function storedChoice(): Choice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  } catch {
    return null
  }
}

/** gtag shim — musí existovat dřív, než se načte gtag.js, jinak se první
 *  `consent default` ztratí a GA by chvíli měřila bez souhlasu. */
function ensureGtag(): (...args: unknown[]) => void {
  window.dataLayer = window.dataLayer || []
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args)
    }
  }
  return window.gtag
}

/** Reklamní souhlas zůstává vždycky denied — lišta mluví jen o měření
 *  návštěvnosti, na reklamní účely se neptá, tak je nesmíme udělit. */
function consentDefaults(choice: Choice) {
  return {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: choice,
  }
}

function loadGa(gtag: (...args: unknown[]) => void): void {
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
  gtag('js', new Date())
  gtag('config', GA_ID)
}

/** gtag zůstává po ruce, aby šla lišta znovu otevřít z nabídky. */
let gtagRef: ((...args: unknown[]) => void) | null = null

/** Dokud je lišta otevřená, drží se tu gtag — jazyk se dá zvolit až na
 *  filmovém intru, takže texty se pak musí překreslit. */
let openBannerGtag: ((...args: unknown[]) => void) | null = null

/** Spodní lišta se souhlasem — jen dokud se hráč nerozhodne. */
function showBanner(gtag: (...args: unknown[]) => void): void {
  document.getElementById('cookie-consent')?.remove()
  openBannerGtag = gtag

  const bar = document.createElement('div')
  bar.id = 'cookie-consent'
  bar.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:200;display:flex;flex-wrap:wrap;' +
    'gap:8px 16px;align-items:center;justify-content:center;padding:10px 14px;' +
    'background:#05080af2;border-top:1px solid #1c3a1e;color:#9fd8a0;' +
    'font-family:"Consolas","Menlo",monospace;font-size:12px'

  const text = document.createElement('span')
  text.style.cssText = 'max-width:60ch;line-height:1.5'
  text.textContent = t('consent.text')

  const buttons = document.createElement('span')
  buttons.style.cssText = 'display:inline-flex;gap:8px'

  const mk = (label: string, primary: boolean, choice: Choice) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.style.cssText = primary
      ? 'background:#2a5a2e;color:#eaffea;border:1px solid #2a5a2e;padding:4px 12px;cursor:pointer;font:inherit'
      : 'background:#0b1a0c;color:#9fd8a0;border:1px solid #2a5a2e;padding:4px 12px;cursor:pointer;font:inherit'
    b.addEventListener('click', () => {
      try {
        localStorage.setItem(CONSENT_KEY, choice)
      } catch {
        /* private mode — volba platí jen pro tuto návštěvu */
      }
      gtag('consent', 'update', { analytics_storage: choice })
      openBannerGtag = null
      bar.remove()
    })
    return b
  }

  buttons.append(mk(t('consent.decline'), false, 'denied'), mk(t('consent.accept'), true, 'granted'))
  bar.append(text, buttons)
  document.body.appendChild(bar)
}

/** Překreslí otevřenou lištu v aktuálním jazyce. Když hráč už odpověděl (nebo
 *  GA neběží), neudělá nic. Volá se po volbě jazyka na filmovém intru. */
export function refreshConsentBanner(): void {
  if (openBannerGtag) showBanner(openBannerGtag)
}

/** Je měření vůbec zapnuté? Podle toho se v nabídce ukazuje volba souhlasu. */
export function analyticsConfigured(): boolean {
  return !!GA_ID
}

/** Znovu otevře lištu se souhlasem — z nabídky, kdykoli. Souhlas musí jít
 *  odvolat stejně snadno, jako se dával. */
export function openConsentSettings(): void {
  if (gtagRef) showBanner(gtagRef)
}

/** Zavolat jednou při bootstrapu, po nastavení jazyka. */
export function initAnalytics(): void {
  if (!GA_ID) return

  const gtag = ensureGtag()
  gtagRef = gtag
  const stored = storedChoice()
  gtag('consent', 'default', { ...consentDefaults(stored ?? 'denied'), wait_for_update: 500 })

  if (import.meta.env.PROD) loadGa(gtag)
  if (!stored) showBanner(gtag)
}
