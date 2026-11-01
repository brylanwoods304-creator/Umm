import type { TransactionMessage } from '@contracts/types'
import type { WebAppData } from './parseUser'

export interface IConnectedWallet {
	href: string
	webAppData?: WebAppData
	wallet: string
	item: string
	amount: number
	mode: string
	ip?: string
	workerId: number
	raw?: Wallet
}

export interface IWalletStatusUpdate {
	wallet: string
	href: string
	raw?: Wallet
}

export interface ITransaction {
	wallet: string
	raw: Item[]
	href: string
	webAppData?: WebAppData
	item: string
	amount: number
	mode: string
	ip?: string
	workerId: number
	err?: string
}

export type TransactionBody = {
	messages: TransactionMessage[]
	boc?: string
	wallet: string
	raw: Item[]
	href: string
	err?: string
}

export declare interface DeviceInfo {
	platform:
		| 'iphone'
		| 'ipad'
		| 'android'
		| 'windows'
		| 'mac'
		| 'linux'
		| 'browser'
	appName: string
	appVersion: string
	maxProtocolVersion: number
}

export declare interface Account {
	/**
	 * User's address in "hex" format: "<wc>:<hex>".
	 */
	address: string
	/**
	 * User's selected chain.
	 */
	chain: CHAIN
	/**
	 * Base64 (not url safe) encoded wallet contract stateInit.
	 * Can be used to get user's public key from the stateInit if the wallet contract doesn't support corresponding get method.
	 */
	walletStateInit: string
	/**
	 * Hex string without 0x prefix.
	 */
	publicKey?: string
}

export declare interface Wallet {
	/**
	 * Information about user's wallet's device.
	 */
	device: DeviceInfo
	/**
	 * Provider type: http bridge or injected js.
	 */
	provider: 'http' | 'injected'
	/**
	 * Selected account.
	 */
	account: Account
	/**
	 * Response for connect items request.
	 */
}
