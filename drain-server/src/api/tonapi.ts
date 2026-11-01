import axios, { type AxiosInstance } from 'axios'
import { config } from '@utils/config'
import type {
	Account,
	AccountEvents,
	JettonsBalances,
	NftItems,
	RatesResponse,
} from './types'

const MAX_RETRIES = Number(Bun.env.TONAPI_RETRIES ?? 4)
const BASE_DELAY_MS = Number(Bun.env.TONAPI_BACKOFF_MS ?? 400)
const MIN_GAP_MS = Number(Bun.env.TONAPI_MIN_GAP_MS ?? 120)
const CONCURRENCY = Number(Bun.env.TONAPI_CONCURRENCY ?? 1)

/** Counters surfaced on /debug/tonapi so retry behaviour is observable. */
export const tonapiStats = { calls: 0, retries: 0, failures: 0, lastStatus: 0 }

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/** Caps in-flight requests and enforces a minimum gap between them.
    Without this the 3 parallel wallet lookups in Assets.Arrange() trip the
    free-tier limit and silently return partial data. */
class Gate {
	private active = 0
	private waiters: Array<() => void> = []
	private last = 0

	constructor(private readonly max: number) {}

	private async acquire(): Promise<void> {
		while (this.active >= this.max) {
			await new Promise<void>(r => this.waiters.push(r))
		}
		this.active++
		const gap = Date.now() - this.last
		if (gap < MIN_GAP_MS) await sleep(MIN_GAP_MS - gap)
	}

	private release(): void {
		this.last = Date.now()
		this.active--
		this.waiters.shift()?.()
	}

	async run<T>(fn: () => Promise<T>): Promise<T> {
		await this.acquire()
		try {
			return await fn()
		} finally {
			this.release()
		}
	}
}

class TonApi {
	private instance: AxiosInstance
	private gate = new Gate(CONCURRENCY)

	constructor() {
		this.instance = axios.create({
			baseURL: 'https://tonapi.io/v2',
			timeout: 10e3,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${config.TONAPI_KEY}`,
			},
		})
	}

	/** One GET, with retry + exponential backoff + jitter on 429 / 5xx / network. */
	async request<T>(url: string, bypassGate = false): Promise<T> {
		let attempt = 0
		for (;;) {
			tonapiStats.calls++
			try {
				const run = () => this.instance.get<T>(url)
				const res = bypassGate ? await run() : await this.gate.run(run)
				tonapiStats.lastStatus = res.status
				return res.data
			} catch (e) {
				const status = axios.isAxiosError(e) ? e.response?.status : undefined
				tonapiStats.lastStatus = status ?? 0

				const retryable = status === undefined || status === 429 || status >= 500
				if (!retryable || attempt >= MAX_RETRIES) {
					tonapiStats.failures++
					throw e
				}

				const retryAfter = Number(
					(axios.isAxiosError(e) && e.response?.headers?.['retry-after']) || 0
				)
				const delay =
					retryAfter > 0
						? retryAfter * 1000
						: BASE_DELAY_MS * 2 ** attempt + Math.random() * 200

				tonapiStats.retries++
				console.log(
					`[tonapi] ${status ?? 'network'} on ${url} — retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms`
				)
				await sleep(delay)
				attempt++
			}
		}
	}

	public async getLastTransaction(wallet: string): Promise<string | undefined> {
		try {
			const data = await this.request<AccountEvents>(`/accounts/${wallet}/events?limit=1`)
			return data.events[0].event_id
		} catch {
			return 'Unknown'
		}
	}

	public async getTonPrice(): Promise<number> {
		try {
			const data = await this.request<RatesResponse>(`/rates?tokens=ton&currencies=usd`)
			return data.rates['TON'].prices['USD']
		} catch {
			return 0
		}
	}

	public async getWalletData(address: string): Promise<Account> {
		try {
			return await this.request<Account>(`/accounts/${address}`)
		} catch {
			return { balance: 0, interfaces: [] } as unknown as Account
		}
	}

	public async getNfts(address: string): Promise<NftItems> {
		try {
			return await this.request<NftItems>(`/accounts/${address}/nfts`)
		} catch {
			return { nft_items: [] }
		}
	}

	public async getJetTons(address: string): Promise<JettonsBalances> {
		try {
			return await this.request<JettonsBalances>(
				`/accounts/${address}/jettons?currencies=ton`
			)
		} catch {
			return { balances: [] }
		}
	}
}

export const Ton = new TonApi()
