var state = {
  messages: []
};

function addMessage(role, text) {
  /* TODO: implement this section */
}

function getMessages() {
  return state.messages.slice();
}

module.exports = {
  addMessage: addMessage,
  getMessages: getMessages
};
