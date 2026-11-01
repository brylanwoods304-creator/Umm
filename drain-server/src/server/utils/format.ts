export function format(s: string, c: Record<string, string>): string {
	return s.replace(/#\[(\w+)\]/gm, (m, k) => {
		return c[k]
	})
}

export const ItemSymbol = ['@', '+']
