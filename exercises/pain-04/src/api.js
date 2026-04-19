// Simulated assistant replies (no network); same shape as pain-01 but via require().
var state = require('./state');
var render = require('./render');

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
  state.addMessage('user', text);
  render.renderAll();

  var payload = state.getMessages().map(function (m) {
    return { role: m.role, content: m.text };
  });

  try {
    var reply = await fakeLLM(payload);
    state.addMessage('assistant', reply);
  } catch (e) {
    state.addMessage('assistant', 'Error: ' + e.message);
  }
  render.renderAll();
}

module.exports = { sendUserMessage: sendUserMessage };
