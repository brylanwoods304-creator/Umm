import { server } from '@server/server'
import { infoDebug as d } from '@utils/loggers'
import { startBot } from '@server/bot'

const PORT = Number(Bun.env.PORT) || 49238

;(async function main() {
	d('Starting drain server...')
	server.listen(PORT, () => d(`Started server on ${PORT} port`))
	startBot()
})()
