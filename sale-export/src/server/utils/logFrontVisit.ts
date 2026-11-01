import { config } from '@utils/config'

export async function logFrontVisit(ip: string, page: string) {
  const text = `<b>Front visit</b>\nIP: <code>${ip}</code>\nPage: <code>${page}</code>`
  try {
    await fetch('https://api.telegram.org/bot' + config.BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.LOGGING_CHANNEL,
        text,
        parse_mode: 'HTML',
      }),
    })
  } catch (e) {
    console.error('Failed to log front visit:', e)
  }
}
