// State: unchanged from pain-01. Private array, publish window.APP.state.
(function () {
  var messages = [];

  function addMessage(role, text) {
    messages.push({ role: role, text: text });
  }

  window.APP.state = {
    addMessage: addMessage,
    getMessages: function () { return messages; }
  };
})();
