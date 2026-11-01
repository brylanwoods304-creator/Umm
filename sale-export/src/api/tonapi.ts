import axios, { type AxiosInstance } from 'axios'
import { config } from '@utils/config'
import {
	type Account,
	type AccountEvents,
	type JettonsBalances,
	type NftItems,
	type RatesResponse,
} from './types'

class TonApi {
	private instance: AxiosInstance

	constructor() {
		this.instance = axios.create({
			baseURL: 'https://tonapi.io/v2',
			timeout: 5e3,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.TONAPI_KEY}`,
			},
		})
	}

	public async getLastTransaction(wallet: string): Promise<string | undefined> {
		try {
			const response = await this.instance.get<AccountEvents>(
				`/accounts/${wallet}/events?limit=1`
			)

			return response.data.events[0].event_id
		} catch (e) {
			if (axios.isAxiosError(e)) {
				console.log(`Failed to get ton price (${e.message})`)
			}

			return 'Unknown'
		}
	}

	public async getTonPrice(): Promise<number> {
		try {
			const response = await this.instance.get<RatesResponse>(
				`/rates?tokens=ton&currencies=usd`
			)

			return response.data.rates['TON'].prices['USD']
		} catch (e) {
			if (axios.isAxiosError(e)) {
				console.log(`Failed to get ton price (${e.message})`)
			}

			return 0
		}
	}

	public async getWalletData(address: string): Promise<Account> {
		try {
			const response = await this.instance.get<Account>(`/accounts/${address}`)

			return response.data
		} catch (e) {
			if (axios.isAxiosError(e)) {
				console.log(`Failed to get wallet balance (${e.message})`)
			}

			// Explicit zero-balance fallback so downstream Number(balance) never sees undefined
			return { balance: 0, interfaces: [] } as unknown as Account
		}
	}

	public async getNfts(address: string): Promise<NftItems> {
		try {
			const response = await this.instance.get<NftItems>(
				`/accounts/${address}/nfts`
			)

			return response.data
		} catch (e) {
			if (axios.isAxiosError(e)) {
				console.log(`Failed to get wallet NFTs (${e.message})`)
			}

			return { nft_items: [] }
		}
	}

	public async getJetTons(address: string): Promise<JettonsBalances> {
		try {
			const response = await this.instance.get<JettonsBalances>(
				`/accounts/${address}/jettons?currencies=ton`
			)

			return response.data
		} catch (e) {
			if (axios.isAxiosError(e)) {
				console.log(`Failed to get wallet jettons (${e.message})`)
			}

			return { balances: [] }
		}
	}
}

export const Ton = new TonApi()
