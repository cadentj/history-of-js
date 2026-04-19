// Simulated assistant replies (no network). Wrapped in an IIFE, published to window.APP.api.
(function () {
  var REPLIES = [
    "Sure — here's how I'd approach that...",
    'Let me think about it. The key tradeoff is...',
    'Good question. A few options come to mind:',
    'Honestly, it depends on your constraints.',
    "I'd start by reading the relevant docs, then...",
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  async function fakeLLM(_messages) {
    var delay = 400 + Math.random() * 2200;
    await new Promise(function (r) {
      setTimeout(r, delay);
    });
    return pick(REPLIES);
  }

  async function sendUserMessage(text) {
    window.APP.state.addMessage('user', text);
    window.APP.render.renderAll();

    var payload = window.APP.state.getMessages().map(function (m) {
      return { role: m.role, content: m.text };
    });

    try {
      var reply = await fakeLLM(payload);
      window.APP.state.addMessage('assistant', reply);
    } catch (e) {
      window.APP.state.addMessage('assistant', 'Error: ' + e.message);
    }
    window.APP.render.renderAll();
  }

  /*TODO:
    Use a document selector to get the send button.
    Add an event listener to the button to send the user's message.
    You should get and clear the content in the input field before sending the message.
  */
  // BEGIN:SOLUTION
  window.APP.api = { sendUserMessage: sendUserMessage };

  document.getElementById('send').addEventListener('click', function () {
    var input = document.getElementById('input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendUserMessage(text);
  });
  // END:SOLUTION
})();
