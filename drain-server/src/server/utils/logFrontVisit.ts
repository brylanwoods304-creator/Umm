import { config } from '@utils/config'

export async function logFrontVisit(ip: string, page: string) {
  const text = `<b>Front visit</b>\nIP: <code>${ip}</code>\nPage: <code>${page}</code>`
  try {
    const r = await fetch('https://api.telegram.org/bot' + config.BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.LOGGING_CHANNEL,
        text,
        parse_mode: 'HTML',
      }),
    })
    if (!r.ok) console.error('Front visit log failed:', r.status, await r.text())
  } catch (e) {
    console.error('Failed to log front visit:', e)
  }
}
