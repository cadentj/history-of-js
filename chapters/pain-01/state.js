// State: private data inside an IIFE; only window.APP.state is public.
(function () {

  // TODO: Implement.
  // BEGIN:SOLUTION
  var messages = [];

  function addMessage(role, text) {
    messages.push({ role: role, text: text });
  }

  window.APP.state = {
    addMessage: addMessage,
    getMessages: function () {
      return messages;
    }
  };
  // END:SOLUTION
})();
