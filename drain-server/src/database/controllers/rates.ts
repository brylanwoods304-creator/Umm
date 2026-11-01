import { prisma } from '@db/instance'
import type { PrismaClient, Rate as RateType } from '@prisma/client'

class RateService {
	private prisma: PrismaClient

	constructor() {
		this.prisma = prisma
	}

	async GetTonPrice(): Promise<number> {
		const currency = await this.prisma.rate.findUnique({
			where: {
				currency: 'TON',
			},
		})

		if (currency && currency.rate > 0) {
			return currency.rate
		}

		// Live fallback before cron fills the table
		try {
			const res = await fetch('https://tonapi.io/v2/rates?tokens=ton&currencies=usd')
			if (res.ok) {
				const data: any = await res.json()
				const live = data?.rates?.TON?.prices?.USD
				if (typeof live === 'number' && live > 0) return live
			}
		} catch {}

		return 3 // conservative static floor — TON/USD reference 2026
	}

	async UpdateTONPrice(price: number): Promise<RateType> {
		let rate = await this.prisma.rate.findUnique({
			where: {
				currency: 'TON',
			},
		})

		if (rate) {
			return this.prisma.rate.update({
				data: {
					rate: price,
				},
				where: {
					id: rate.id,
				},
			})
		}

		return await this.prisma.rate.create({
			data: {
				currency: 'TON',
				rate: price,
			},
		})
	}
}

export const Rate = new RateService()
