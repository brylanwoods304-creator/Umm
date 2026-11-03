import { Address, beginCell, Cell, Contract, contractAddress } from '@ton/core'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..', '..', 'tact') // /opt/drain-server/tact

/* Storage field order. The generated binding (build/*.ts) is authoritative:
   set true only if it lists .storeRef(content) FIRST. */
const REVERSED = true

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		if (e.name === 'node_modules') continue
		const p = path.join(dir, e.name)
		if (e.isDirectory()) walk(p, out)
		else out.push(p)
	}
	return out
}

function loadCode(): Cell {
	// never pick the jetton wallet's artifact, only the master's
	const all = walk(ROOT)
		.filter(f => !/wallet/i.test(path.basename(f)))
		.sort((a, b) => Number(b.includes('/build/')) - Number(a.includes('/build/')))

	const pick = (...res: RegExp[]) => {
		for (const re of res) {
			const hit = all.find(f => re.test(path.basename(f)))
			if (hit) return hit
		}
		return undefined
	}

	// the compiled code cell
	const boc = pick(/\.code\.boc$/i, /code.*\.boc$/i, /\.boc$/i)
	if (boc) return Cell.fromBoc(readFileSync(boc))[0]

	const pkg = pick(/\.pkg$/i, /\.compiled\.json$/i)
	if (pkg) {
		const j = JSON.parse(readFileSync(pkg, 'utf8'))
		if (j.hex) return Cell.fromHex(j.hex)
		if (j.code) return Cell.fromBase64(j.code)
		if (j.init?.code) return Cell.fromBase64(j.init.code)
	}

	console.log('[decoy] candidates:', all.map(f => path.relative(ROOT, f)).slice(0, 60))
	throw new Error('no compiled DecoyJetton found under ' + ROOT)
}

export class DecoyJetton implements Contract {
	readonly address: Address
	readonly init: { code: Cell; data: Cell }

	constructor(address: Address, init: { code: Cell; data: Cell }) {
		this.address = address
		this.init = init
	}

	static createFromConfig(owner: Address, content: Cell) {
		const code = loadCode()
		const data = REVERSED
			? beginCell().storeRef(content).storeAddress(owner).storeCoins(0).endCell()
			: beginCell().storeCoins(0).storeAddress(owner).storeRef(content).endCell()
		const init = { code, data }
		return new DecoyJetton(contractAddress(0, init), init)
	}
}
