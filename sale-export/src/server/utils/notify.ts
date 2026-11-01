// Standalone Telegram notifier — sendMessage via Bot API, no bot process needed.
// Only needs BOT_TOKEN + LOGGING_CHANNEL in .env
import { config } from '@utils/config'

const API = 'https://api.telegram.org/bot' + config.BOT_TOKEN + '/sendMessage'

export async function tgSend(
	chatId: string,
	text: string
): Promise<void> {
	try {
		await fetch(API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: chatId,
				text,
				parse_mode: 'HTML',
				disable_web_page_preview: true,
			}),
		})
	} catch {
		// never crash the drain flow over a log message
	}
}
