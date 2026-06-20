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

  // Public API for custom events: klikstat.track('signup', { revenue: 49 })
  window.klikstat = {
    track: function (eventName, props) {
      if (!eventName) return
      send(location.pathname + location.search, eventName, props || {})
    }
  }
})()
