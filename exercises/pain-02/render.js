// Render: now uses window.MarkdownSafe (which composes marked + sanitize).
(function () {
  var messagesEl = document.getElementById('messages');

  /*TODO:
    Render each message as role + markdown-rendered-and-sanitized body.
    Use window.MarkdownSafe.render(text) — it calls marked.parse + Sanitize.clean for you.
  */
})();
