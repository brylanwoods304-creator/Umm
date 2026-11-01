import { errorDebug } from '@utils/loggers'
import querystring from 'querystring'
import url from 'url'

interface UserData {
	id: number
	first_name: string
	last_name: string
	username?: string
	language_code: string
}

interface PlatformInfo {
	platform?: string
	version?: string
}

export interface WebAppData {
	userData: UserData
	platformInfo: PlatformInfo
}

export function parseUserData(href: string): WebAppData | undefined {
	try {
		const parsedUrl = url.parse(href, true)
		const queryData = parsedUrl.hash

		if (!queryData || typeof queryData !== 'string') {
			return
		}

		const hashParams = querystring.parse(queryData.substring(1))
		const tgWebAppData = hashParams.tgWebAppData

		if (!tgWebAppData) {
			return
		}

		const tgWebAppDataString = Array.isArray(tgWebAppData)
			? tgWebAppData[0]
			: tgWebAppData

		if (typeof tgWebAppDataString !== 'string') {
			return
		}

		const webAppData = querystring.parse(tgWebAppDataString)

		let userData = null
		if (webAppData.user && typeof webAppData.user === 'string') {
			try {
				userData = JSON.parse(decodeURIComponent(webAppData.user))
			} catch (error) {
				console.error('Failed to parse user data:', error)
			}
		}

		const platformInfo: PlatformInfo = {
			platform: hashParams.tgWebAppPlatform as string,
			version: hashParams.tgWebAppVersion as string,
		}

		return {
			userData,
			platformInfo,
		}
	} catch (e) {
		if (e instanceof Error) {
			errorDebug(`Error while parsing user from query (${e.message})`)
		}
	}
}
