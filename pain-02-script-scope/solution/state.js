(function () {
  var messages = [];

  function addMessage(role, text) {
    /* BEGIN_PROBLEM_EXCLUDE */
    messages.push({ role: role, text: text });
    /* END_PROBLEM_EXCLUDE */
  }

  window.APP.state = {
    addMessage: addMessage,
    getMessages: function () { return messages.slice(); }
  };
})();
