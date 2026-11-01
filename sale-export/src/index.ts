import { server } from '@server/server'
import { infoDebug as d } from '@utils/loggers'

// Standalone drain server — no telegram bot process, logging via Bot API sendMessage
;(async function main() {
	d('Starting drain server...')

	server.listen(49238, () => d('Started server on 49238 port'))
})()

// 49238
