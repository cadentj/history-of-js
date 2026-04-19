// Render: DOM refs and helpers stay inside an IIFE; publish via window.APP.render.
(function () {
  var messagesEl = document.getElementById('messages');

  /**
   * Characters like <, >, &, ", ', etc. are interpreted as HTML tags or entities.
   * This function renders them as plain text.
   * @param {string} s - The string to escape.
   * @returns {string} The escaped string.
   */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // TODO: Implement
  // BEGIN:SOLUTION
  function renderAll() {
    var list = window.APP.state.getMessages();
    messagesEl.innerHTML = list
      .map(function (m) {
        return (
          '<div>' + escapeHtml(m.role) + ': ' + escapeHtml(m.text) + '</div>'
        );
      })
      .join('');
  }

  window.APP.render = { renderAll: renderAll };
  // END:SOLUTION
})();
