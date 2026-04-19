// Render: now uses window.MarkdownSafe (which composes marked + sanitize).
(function () {
  var messagesEl = document.getElementById('messages');

  /*TODO:
    Render each message as role + markdown-rendered-and-sanitized body.
    Use window.MarkdownSafe.render(text) — it calls marked.parse + Sanitize.clean for you.
  */
  // BEGIN:SOLUTION
  function renderAll() {
    var list = window.APP.state.getMessages();
    messagesEl.innerHTML = list
      .map(function (m) {
        var body = window.MarkdownSafe.render(m.text);
        return '<div><strong>' + m.role + ':</strong> ' + body + '</div>';
      })
      .join('');
  }

  window.APP.render = { renderAll: renderAll };
  // END:SOLUTION
})();
