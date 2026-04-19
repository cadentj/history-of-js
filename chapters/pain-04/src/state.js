// State: CJS version. No IIFE, no window.APP assignment here — just exports.
var messages = [];

function addMessage(role, text) {
  messages.push({ role: role, text: text });
}

module.exports = {
  addMessage: addMessage,
  getMessages: function () { return messages; }
};
