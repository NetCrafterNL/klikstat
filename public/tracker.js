;(function () {
  'use strict'

  var script  = document.currentScript
  var token   = script && script.getAttribute('data-token')
  if (!token) return

  var apiBase  = script.getAttribute('data-api') || (script.src || '').replace(/\/[^/]*tracker\.js(\?.*)?$/, '')
  var endpoint = apiBase.replace(/\/$/, '') + '/api/collect'

  function send(pathname, type, extra) {
    var params = new URLSearchParams(location.search)
    var payload = JSON.stringify(Object.assign({
      token:        token,
      type:         type || 'pageview',
      pathname:     pathname,
      referrer:     document.referrer || '',
      width:        window.innerWidth,
      utm_source:   params.get('utm_source')   || '',
      utm_medium:   params.get('utm_medium')   || '',
      utm_campaign: params.get('utm_campaign') || '',
    }, extra || {}))
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }))
      } else {
        fetch(endpoint, { method:'POST', body:payload, headers:{'Content-Type':'application/json'}, keepalive:true })
      }
    } catch (_) {}
  }

  // Initial pageview
  send(location.pathname + location.search)

  // SPA navigation
  var _push = history.pushState.bind(history)
  history.pushState = function () {
    _push.apply(history, arguments)
    send(location.pathname + location.search)
  }
  window.addEventListener('popstate', function () {
    send(location.pathname + location.search)
  })

  // ─── Scroll depth tracking ──────────────────────────────────────────────
  var scrollFired = {}
  var DEPTHS = [25, 50, 75, 100]
  function getScrollPct() {
    var el  = document.documentElement
    var top = el.scrollTop || document.body.scrollTop
    var h   = el.scrollHeight - el.clientHeight
    return h > 0 ? Math.round((top / h) * 100) : 100
  }
  function onScroll() {
    var pct = getScrollPct()
    for (var i = 0; i < DEPTHS.length; i++) {
      var d = DEPTHS[i]
      if (pct >= d && !scrollFired[d]) {
        scrollFired[d] = true
        send(location.pathname + location.search, 'scroll', { depth: d })
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  // Check depth on load (page may already be scrolled via anchor)
  setTimeout(onScroll, 500)

  // ─── Outbound link tracking ─────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var el = e.target
    while (el && el.tagName !== 'A') el = el.parentElement
    if (!el) return
    var href = el.getAttribute('href') || ''
    if (!href.match(/^https?:\/\//)) return
    try {
      var host = new URL(href).hostname
      if (host === location.hostname) return
      send(location.pathname + location.search, 'outbound', { url: href, host: host })
    } catch (_) {}
  }, true)

  // ─── Public API ─────────────────────────────────────────────────────────
  // klikstat.track('purchase', { revenue: 49.99, plan: 'pro' })
  window.klikstat = {
    track: function (eventName, props) {
      if (!eventName) return
      send(location.pathname + location.search, eventName, props || {})
    }
  }
}())
