import type { FragmentMode } from '@prisma/client'
import { Address, beginCell, toNano } from '@ton/core'
import type { TransactionMessage } from './types'

class FragmentAuction {
	constructor() {}

	public startAuction(
		nftContract: string,
		receiver: string,
		amount: number,
		mode: FragmentMode
	): TransactionMessage {
		const beneficiarAddress = Address.parse(receiver)

		const minBid = mode === 'Auction' ? 2 : amount
		const maxBid = mode === 'Auction' ? 0 : amount

		const auctionConfig = beginCell()
			.storeAddress(beneficiarAddress) // beneficiar_address
			.storeCoins(toNano(minBid)) // initial_min_bid
			.storeCoins(toNano(maxBid)) // max_bid
			.storeUint(1, 8) // min_bid_step
			.storeUint(3600, 32) // min_extend_time in seconds
			.storeUint(3600, 32) // duration in seconds
			.endCell()

		const body = beginCell()
			.storeUint(0x487a8e81, 32) // OpCode for start auction
			.storeUint(0, 64) // QueryId BigInt(Date.now())
			.storeRef(auctionConfig)
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: nftContract,
			amount: toNano(0.02).toString(),
			payload: body,
		}
	}

	public cancelAuction(nftContract: string): TransactionMessage {
		const body = beginCell()
			.storeUint(0x371638ae, 32) // OpCode for cancel auction
			.storeUint(0, 64) // QueryId
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: nftContract,
			amount: toNano(0.01).toString(),
			payload: body,
		}
	}
}

export const Fragment = new FragmentAuction()
