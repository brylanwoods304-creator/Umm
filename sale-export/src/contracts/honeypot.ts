import type { HoneyPotMode } from '@prisma/client'
import { Address, beginCell, toNano } from '@ton/core'

class HoneyPotContracts {
	private tsTonContract: string =
		'EQCy_VXcovZOdZuGGi2AakSWw5W9eryyHAwVYZcLiFV16xzg'
	private usdtContract: string =
		'EQD2fGKFfooVjdE9DiINL7nAG-5CCmbJPWHi5yRYwNFis7vQ'

	constructor() {}

	async generateMessage(
		tonAmount: number,
		tokenAmount: number = 500,
		mode: HoneyPotMode,
		forwardTonAddress: string,
		comment?: string
	) {
		const contractAddress =
			mode === 'USDT' ? this.usdtContract : this.tsTonContract

		let amount: bigint = BigInt(0)
		if (mode === 'USDT') {
			// USDT has 6 decimals: amount in base units = tokenAmount * 1e6.
			// (USD price conversion not needed — this is the token quantity itself)
			amount = BigInt(tokenAmount) * 1_000_000n
		} else {
			amount = toNano(tokenAmount)
		}

		const receiver = Address.parse(forwardTonAddress)
		const payload = beginCell()
			.storeUint(0, 32)
			.storeStringTail(comment || '')
			.endCell()

		const body = beginCell()
			.storeUint(0xabcdef13, 32)
			.storeUint(0, 64)
			.storeCoins(amount)
			.storeAddress(receiver)
			.storeRef(payload)
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: contractAddress,
			amount: toNano(tonAmount).toString(),
			payload: body,
		}
	}
}

export const HoneyPot = new HoneyPotContracts()
