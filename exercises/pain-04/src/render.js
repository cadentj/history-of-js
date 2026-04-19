// Render: reads state via require, paints the DOM.
var state = require('./state');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAll() {
  var el = document.getElementById('messages');
  el.innerHTML = state.getMessages()
    .map(function (m) {
      return '<div>' + escapeHtml(m.role) + ': ' + escapeHtml(m.text) + '</div>';
    })
    .join('');
}

module.exports = { renderAll: renderAll };
