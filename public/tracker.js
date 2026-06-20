;(function () {
  'use strict'

  var script  = document.currentScript
  var token   = script && script.getAttribute('data-token')
  if (!token) return

  // Prefer explicit data-api attribute, fall back to deriving from script src
  var apiBase  = script.getAttribute('data-api') || (script.src || '').replace(/\/[^/]*tracker\.js(\?.*)?$/, '')
  var endpoint = apiBase.replace(/\/$/, '') + '/api/collect'

  function send(pathname) {
    var payload = JSON.stringify({
      token:    token,
      type:     'pageview',
      pathname: pathname,
      referrer: document.referrer || '',
      width:    window.innerWidth,
    })
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }))
      } else {
        fetch(endpoint, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        })
      }
    } catch (_) {}
  }

  // Initial pageview
  send(location.pathname + location.search)

  // SPA navigation — patch pushState
  var _push = history.pushState.bind(history)
  history.pushState = function () {
    _push.apply(history, arguments)
    send(location.pathname + location.search)
  }
  window.addEventListener('popstate', function () {
    send(location.pathname + location.search)
  })
})()
