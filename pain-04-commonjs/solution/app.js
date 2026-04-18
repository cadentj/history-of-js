var state = require('./state');
var render = require('./render');

function runDemo() {
  state.addMessage('user', 'hello');
  state.addMessage('assistant', 'hi!');
  return render.renderMessages(state.getMessages());
}

module.exports = { runDemo: runDemo };
