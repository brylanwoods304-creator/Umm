import { Address, beginCell, toNano } from '@ton/core'
import type { TransactionMessage } from './types'

class DedustSwap {
	constructor() {}

	public proceedSwap(receiver: string, amount: number) {
		const recipient = Address.parse(receiver)

		// DeDust v2 native vault — confirmed current mainnet address
		const dedustVault =
			'0:dae153a74d894bbc32748198cd626e4f5df4a69ad2fa56ce80fc2644b5708d20'

		// DeDust v2 TON/USDT volatile pool — derive via factory if needed
		const dedustUSDTPool = Address.parse(
			'EQA-X_yo3fzzbDbJ_0bzFWKqtRuZFIRa1sJsveZJ1YpViO3r'
		)

		// Guard: swap body must carry a positive coin amount
		const swapAmount = Math.max(amount - 0.2, 0.05)

		const swapParams = beginCell()
			.storeUint(0, 32)
			.storeAddress(recipient)
			.storeAddress(null) // referral_addr: none
			.storeMaybeRef()
			.storeMaybeRef()
			.endCell()

		const body = beginCell()
			.storeUint(0xea06185d, 32)
			.storeUint(0, 64)
			.storeCoins(toNano(swapAmount))
			.storeAddress(dedustUSDTPool)
			.storeUint(0, 1)
			.storeCoins(0)
			.storeMaybeRef(null)
			.storeRef(swapParams)
			.endCell()
			.toBoc()

		return {
			address: dedustVault,
			amount: toNano(amount).toString(),
			payload: Buffer.from(body).toString('base64url'),
		}
	}

	public proceedTokenSwap(
		recipient: string,
		tokenAddress: string,
		amount: number
	): TransactionMessage {
		const receiver = Address.parse(recipient)
		const dedustVault = Address.parse(
			'0:caec65d0a002f9b28fe45217bea6397b1aa5ccd92ffeac972710e3d722f8d1bb'
		)

		const swapStepParamsCell = beginCell()
			.storeUint(0, 32) // kind: SwapKind (given_in)
			.storeMaybeCoins(null) // limit: Coins
			.storeMaybeRef() // next: Maybe ^SwapStep
			.endCell()

		const swapStepCell = beginCell()
			.storeAddress(
				Address.parse(
					'0:6307fd932dda4e8618f6e45fe062633a7cc6fc85b237af1f8403883f00bafd3b'
				)
			)
			.storeRef(swapStepParamsCell) // params: SwapStepParams
			.endCell()

		const swapParamsCell = beginCell()
			.storeUint(0, 32) // deadline: 0 (без дедлайна)
			.storeAddress(receiver) // recipient_addr: MsgAddress (null)
			.storeAddress(null) // referral_addr: MsgAddress (null)
			.storeMaybeRef() // fulfill_payload: Maybe ^Cell (null)
			.storeMaybeRef() // reject_payload: Maybe ^Cell (null)
			.endCell()

		const forwardPayload = beginCell()
			.storeUint(0xe3a0d482, 32) // op_code: DedustSwap
			.storeRef(swapStepCell) // шаг свапа (SwapStep)
			.storeRef(swapParamsCell) // параметры свапа (SwapParams)
			.endCell()

		const body = beginCell()
			.storeUint(0x0f8a7ea5, 32) // jetton transfer op code 0x0f8a7ea5
			.storeUint(0, 64) // query_id:uint64
			.storeCoins(amount)
			.storeAddress(dedustVault) // new_owner:MsgAddress
			.storeAddress(receiver) // response_destination:MsgAddress
			.storeBit(0) // custom_payload:(Maybe ^Cell)
			.storeCoins(toNano(0.15)) // forward_amount:(VarUInteger 16)
			.storeBit(1) // forward_payload:(Either Cell ^Cell)
			.storeRef(forwardPayload)
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: tokenAddress,
			amount: toNano(0.1).toString(),
			payload: body,
		}
	}
}

export const DeDust = new DedustSwap()
