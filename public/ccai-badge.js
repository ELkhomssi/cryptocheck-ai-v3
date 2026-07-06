/**
 * CryptoCheck Verified Badge embed — loads live verdict from /api/revenue/badge/live
 * Usage: <script async src="https://…/ccai-badge.js" data-mint="…" data-target="…"></script>
 */
(function () {
  var DEFAULT_ORIGIN = 'https://www.cryptocheckai.com'

  function scriptOrigin() {
    var s = document.currentScript
    if (s && s.src) {
      try {
        return new URL(s.src).origin
      } catch (e) {
        /* ignore */
      }
    }
    return DEFAULT_ORIGIN
  }

  function verdictColor(verdict) {
    if (verdict === 'SAFE') return '#3FE05A'
    if (verdict === 'CAUTION') return '#F2B84C'
    return '#FF5A6E'
  }

  function render(target, payload, origin) {
    var color = verdictColor(payload.verdict)
    var reportUrl = payload.reportUrl || origin + '/report/' + encodeURIComponent(payload.mint)
    target.innerHTML =
      '<a href="' +
      reportUrl +
      '" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;gap:12px;text-decoration:none;font-family:system-ui,sans-serif;background:#0B1220;color:#E8EDF5;padding:12px 14px;border-radius:8px;border:1px solid ' +
      color +
      '44;box-sizing:border-box;max-width:320px">' +
      '<span style="font-weight:700;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:' +
      color +
      '">' +
      payload.verdict +
      '</span>' +
      '<span style="font-family:ui-monospace,monospace;font-size:20px;font-weight:600">' +
      payload.safetyScore +
      '<span style="font-size:12px;color:#8B9BB4">/100</span></span>' +
      '<span style="margin-left:auto;font-size:10px;color:#6B7A94;max-width:90px;text-align:right">CryptoCheck · paid scan</span>' +
      '</a>'
  }

  function renderError(target, message) {
    target.innerHTML =
      '<div style="font-family:system-ui,sans-serif;background:#0B1220;color:#8B9BB4;padding:12px 14px;font-size:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">' +
      message +
      '</div>'
  }

  function boot() {
    var script = document.currentScript
    if (!script) return
    var mint = script.getAttribute('data-mint')
    var targetId = script.getAttribute('data-target')
    if (!mint || !targetId) return
    var target = document.getElementById(targetId)
    if (!target) return

    var origin = script.getAttribute('data-origin') || scriptOrigin()
    var url = origin.replace(/\/$/, '') + '/api/revenue/badge/live?mint=' + encodeURIComponent(mint)

    fetch(url)
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Badge unavailable')
          return body
        })
      })
      .then(function (payload) {
        render(target, payload, origin)
      })
      .catch(function () {
        renderError(target, 'No verified badge for this token.')
      })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
