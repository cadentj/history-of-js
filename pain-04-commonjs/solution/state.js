var state = {
  messages: []
};

function addMessage(role, text) {
  /* BEGIN_PROBLEM_EXCLUDE */
  state.messages.push({ role: role, text: text });
  /* END_PROBLEM_EXCLUDE */
}

function getMessages() {
  return state.messages.slice();
}

module.exports = {
  addMessage: addMessage,
  getMessages: getMessages
};
