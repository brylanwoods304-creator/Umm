// Deploys your personal decoy jetton master. Mnemonic is created once and kept
// in src/items/deployer.json (gitignore it).
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto'
import { beginCell, internal, toNano, TonClient, WalletContractV4 } from '@ton/ton'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { DecoyJetton } from './decoy'

const ITEMS = path.join(process.cwd(), 'src', 'items')
const DEPLOYER_FILE = path.join(ITEMS, 'deployer.json')
const DECOY_FILE = path.join(ITEMS, 'decoy.json')

/* Public RPCs, tried in order. Set TON_RPC in .env to override, and
   TONCENTER_KEY (free from the @tonapibot bot) to raise the rate limit. */
const ENDPOINTS = [
	process.env.TON_RPC,
	'https://toncenter.com/api/v2/jsonRPC',
	'https://ton-rpc.orbs.network',
].filter(Boolean) as string[]

const clients = ENDPOINTS.map(
	endpoint => new TonClient({ endpoint, apiKey: process.env.TONCENTER_KEY || undefined })
)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const isTransient = (e: any) => {
	const status = String(e?.response?.status ?? '')
	const msg = String(e?.message ?? e)
	return status === '429' || /429|timeout|ECONN|socket|fetch failed|too many/i.test(msg)
}

async function withRetry<T>(
	label: string,
	fn: (c: TonClient) => Promise<T>,
	tries = 4
): Promise<T> {
	let last: any
	for (let round = 0; round < tries; round++) {
		for (const client of clients) {
			try {
				return await fn(client)
			} catch (e: any) {
				last = e
				if (!isTransient(e)) throw e
				console.log(
					`[deployer] ${label} retry (${client.endpoint}): ${String(
						e?.response?.status ?? e?.message ?? e
					).slice(0, 100)}`
				)
			}
		}
		await sleep(2000 * (round + 1))
	}
	throw last
}

function ensureItems() {
	if (!existsSync(ITEMS)) mkdirSync(ITEMS, { recursive: true })
}

export async function deployer(): Promise<string[]> {
	ensureItems()
	if (existsSync(DEPLOYER_FILE)) {
		try {
			const j = JSON.parse(readFileSync(DEPLOYER_FILE, 'utf8'))
			if (Array.isArray(j.mnemonic) && j.mnemonic.length) return j.mnemonic
		} catch {}
	}
	const words = await mnemonicNew()
	const kp = await mnemonicToPrivateKey(words)
	const address = WalletContractV4.create({ publicKey: kp.publicKey, workchain: 0 }).address
	writeFileSync(
		DEPLOYER_FILE,
		JSON.stringify(
			{ mnemonic: words, address: address.toString({ bounceable: false }) },
			null,
			2
		)
	)
	console.log(`[deployer] created ${address.toString({ bounceable: false })} - fund with ~0.3 TON`)
	return words
}

async function openWallet() {
	const kp = await mnemonicToPrivateKey(await deployer())
	const wallet = WalletContractV4.create({ publicKey: kp.publicKey, workchain: 0 })
	return { wallet, kp }
}

export async function deployerWallet() {
	const { wallet, kp } = await openWallet()
	return { wallet, kp, contract: clients[0].open(wallet) }
}

export async function deployerBalance(): Promise<bigint> {
	const { wallet } = await openWallet()
	return withRetry('getBalance', c => c.getBalance(wallet.address))
}

export async function deployDecoy(metadataUrl: string): Promise<string> {
	const { wallet, kp } = await openWallet()

	const balance = await withRetry('getBalance', c => c.getBalance(wallet.address))
	if (balance < toNano('0.12'))
		throw new Error(
			`deployer ${wallet.address.toString({
				bounceable: false,
			})} has ${(Number(balance) / 1e9).toFixed(4)} TON - send it ~0.3 TON first`
		)

	// TEP-64 offchain content: 0x01 || uri (snake)
	const content = beginCell().storeUint(1, 8).storeStringTail(metadataUrl).endCell()
	const decoy = DecoyJetton.createFromConfig(wallet.address, content)

	await withRetry('send', async c => {
		const w = c.open(wallet)
		const seqno = await w.getSeqno()
		await w.sendTransfer({
			seqno,
			secretKey: kp.secretKey,
			messages: [
				internal({
					to: decoy.address,
					value: toNano('0.1'),
					bounce: false,
					init: decoy.init,
					body: beginCell().endCell(),
				}),
			],
		})
	})

	const address = decoy.address.toString({ bounceable: false, urlSafe: true })
	ensureItems()
	writeFileSync(DECOY_FILE, JSON.stringify({ address }, null, 2))
	return address
}
