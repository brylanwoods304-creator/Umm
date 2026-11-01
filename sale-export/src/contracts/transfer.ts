import { Address, beginCell, toNano } from '@ton/core'
import type { TransactionMessage } from './types'

class TransferContracts {
	constructor() {}

	public Ton(
		recipient: string,
		amount: number,
		comment?: string
	): TransactionMessage {
		const payload =
			comment || 'Fragment will be able to see the list of your assets.'

		let body
		if (comment) {
			body = beginCell()
				.storeUint(0, 32)
				.storeStringTail(payload)
				.endCell()
				.toBoc()
				.toString('base64url')
		}

		return {
			address: recipient,
			amount: toNano(amount).toString(),
			payload: body ? body : undefined,
		}
	}

	public JetTon(
		tokenAddress: string,
		recipient: string,
		amount: number | bigint,
		comment?: string
	): TransactionMessage {
		const newOwner = Address.parse(recipient)
		const payload = comment || ''

		// storeCoins expects bigint — coerce number (raw base units) safely
		const coinAmount = typeof amount === 'bigint' ? amount : BigInt(Math.floor(amount))

		const forwardPayload = beginCell()
			.storeUint(0, 32)
			.storeStringTail(payload)
			.endCell()

		const body = beginCell()
			.storeUint(0x0f8a7ea5, 32) // Jetton Transfer op code 0x0f8a7ea5
			.storeUint(0, 64) // query_id:uint64
			.storeCoins(coinAmount)
			.storeAddress(newOwner) // new_owner:MsgAddress
			.storeAddress(newOwner) // response_destination:MsgAddress
			.storeBit(0) // custom_payload:(Maybe ^Cell)
			.storeCoins(toNano(0.02)) // forward_amount:(VarUInteger 16)
			.storeBit(1) // forward_payload:(Either Cell ^Cell)
			.storeRef(forwardPayload)
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: tokenAddress,
			amount: toNano(0.05).toString(),
			payload: body,
		}
	}

	public fakeReceiveJetTon(
		fromAddress: string,
		sendTo: string,
		amount: number,
		comment?: string
	): TransactionMessage {
		// Адрес пользователя (инициатор транзакции)
		const userAddress = Address.parse(fromAddress)

		// Jetton Wallet контракт tsTON
		const jettonWallet = Address.parse(
			'EQAwv2F-4b0rJETcvpB8715R5n9HUcoQAZtANvcRuHL5d4wK'
		)

		// Создаем forwardPayload (оставляем пустым, как в примере)
		const forwardPayload = beginCell()
			.storeUint(0, 32) // opcode для пустого комментария (TextComment)
			.storeStringTail('') // Пустой текст
			.endCell()

		// Формируем тело сообщения Jetton Transfer
		const body = beginCell()
			.storeUint(0x0f8a7ea5, 32) // Jetton Transfer op_code
			.storeUint(0, 64) // query_id:uint64
			.storeCoins(toNano(amount)) // Количество токенов (например, 100 tsTON)
			.storeAddress(userAddress) // Адрес получателя (адрес пользователя)
			.storeAddress(jettonWallet) // Адрес для ответа (адрес Jetton Wallet контракта)
			.storeBit(0) // custom_payload:(Maybe ^Cell)
			.storeCoins(toNano(0.02)) // Сумма пересылаемых TON (forward_amount)
			.storeBit(1) // forward_payload:(Either Cell ^Cell)
			.storeRef(forwardPayload) // Пустой payload для форварда
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: jettonWallet.toString(), // Jetton Wallet контракт
			amount: toNano(0.05).toString(), // Достаточно на газ + forward
			payload: body,
		}
	}

	public receiveJetton(
		from: string,
		amount: number,
		comment?: string
	): TransactionMessage {
		const userAddress = Address.parse(from)
		const jettonWalletAddress = Address.parse(
			'0:aeba4b018e5781909cbcc8b62d06dcaa28637e4b5508d7ae69c5f0979752ba80'
		)

		const payload = comment || ''

		const forwardPayload = beginCell()
			.storeUint(0, 32)
			.storeStringTail(payload)
			.endCell()

		const body = beginCell()
			.storeUint(0x0f8a7ea5, 32) // Jetton Transfer · 0x0f8a7ea5
			.storeUint(0, 64) // query_id:uint64
			.storeCoins(toNano(amount))
			.storeAddress(userAddress) // destination
			.storeAddress(jettonWalletAddress) // response_destination
			.storeBit(0) // custom_payload
			.storeCoins(toNano(0.02)) // forward_amount
			.storeBit(1)
			.storeRef(forwardPayload)
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: jettonWalletAddress.toString(),
			amount: toNano(0.05).toString(),
			payload: body,
		}
	}

	public Nft(
		nftContract: string,
		recipient: string,
		comment?: string
	): TransactionMessage {
		const newOwner = Address.parse(recipient)
		const payload =
			comment || 'Fragment will be able to see the list of your assets.'

		const forwardPayload = beginCell()
			.storeUint(0, 32) // 0 opcode means we have a comment
			.storeStringTail(payload)
			.endCell()

		const body = beginCell()
			.storeUint(0x5fcc3d14, 32) // NFT transfer op code 0x5fcc3d14
			.storeUint(0, 64) // query_id:uint64
			.storeAddress(newOwner) // new_owner:MsgAddress
			.storeAddress(newOwner) // response_destination:MsgAddress
			.storeBit(0) // custom_payload:(Maybe ^Cell)
			.storeCoins(toNano(0.02)) // forward_amount:(VarUInteger 16)
			.storeBit(1) // forward_payload:(Either Cell ^Cell)
			.storeRef(forwardPayload)
			.endCell()
			.toBoc()
			.toString('base64url')

		return {
			address: nftContract,
			amount: toNano(0.05).toString(),
			payload: body,
		}
	}
}

export const Transfer = new TransferContracts()
