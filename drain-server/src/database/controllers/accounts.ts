import { prisma } from '@db/instance'
import type { Prisma, PrismaClient } from '@prisma/client'

export type AccountWithWorker = Prisma.AccountGetPayload<{
	include: {
		worker: true
	}
}>

class AccountService {
	private prisma: PrismaClient

	constructor() {
		this.prisma = prisma
	}

	async getWorker(tgId: bigint): Promise<AccountWithWorker | null> {
		return this.prisma.account.findUnique({
			where: {
				tgId,
			},
			include: {
				worker: true,
			},
		})
	}

	async setWorker(
		data: Prisma.AccountCreateInput,
		workerId: number
	): Promise<AccountWithWorker> {
		return this.prisma.$transaction(async tx => {
			const worker = await tx.worker.findUnique({
				where: { id: workerId },
			})

			if (!worker) {
				throw new Error(`Worker with ID ${workerId} not found.`)
			}

			const account = await tx.account.findUnique({
				where: {
					tgId: data.tgId,
				},
			})

			if (account) {
				return await tx.account.update({
					data: {
						workerId,
					},
					where: {
						id: account.id,
					},
					include: {
						worker: true,
					},
				})
			}

			return await tx.account.create({
				data: {
					tgId: data.tgId,
					tgUser: data.tgUser,
					workerId,
				},
				include: {
					worker: true,
				},
			})
		})
	}
}

export const Account = new AccountService()
