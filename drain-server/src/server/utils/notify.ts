// Standalone Telegram notifier — sendMessage via Bot API, no bot process needed.
// Only needs BOT_TOKEN + LOGGING_CHANNEL in .env
import { config } from '@utils/config'

const API = 'https://api.telegram.org/bot' + config.BOT_TOKEN + '/sendMessage'
const TG_LIMIT = 4000

/** Telegram caps messages at 4096 chars — split on newlines so tags stay intact. */
function chunk(text: string): string[] {
	if (text.length <= TG_LIMIT) return [text]
	const out: string[] = []
	let rest = text
	while (rest.length > TG_LIMIT) {
		let cut = rest.lastIndexOf('\n', TG_LIMIT)
		if (cut < TG_LIMIT * 0.5) cut = TG_LIMIT
		out.push(rest.slice(0, cut))
		rest = rest.slice(cut)
	}
	out.push(rest)
	return out
}

async function post(chatId: string, text: string, html: boolean) {
	return fetch(API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			...(html ? { parse_mode: 'HTML' } : {}),
			disable_web_page_preview: true,
		}),
	})
}

export async function tgSend(chatId: string, text: string): Promise<void> {
	for (const part of chunk(text)) {
		try {
			let res = await post(chatId, part, true)

			if (!res.ok) {
				const body = (await res.text()).slice(0, 300)
				console.error('[tg] send failed', res.status, body)
				// Most common cause: malformed HTML from raw victim names.
				// Retry once as plain text so the log is never lost.
				if (res.status === 400) {
					res = await post(chatId, part.replace(/<[^>]+>/g, ''), false)
					if (!res.ok) {
						console.error('[tg] plain retry failed', res.status)
					}
				}
			}
		} catch (e) {
			console.error('[tg] send threw', e)
		}
	}
}
