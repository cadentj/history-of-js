(function () {
  var messages = [];

  function addMessage(role, text) {
    /* TODO: implement this section */
  }

  window.APP.state = {
    addMessage: addMessage,
    getMessages: function () { return messages.slice(); }
  };
})();
