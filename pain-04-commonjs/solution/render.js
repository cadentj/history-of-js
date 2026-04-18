function renderMessages(messages) {
  /* BEGIN_PROBLEM_EXCLUDE */
  return messages.map(function (m) {
    return '[' + m.role + '] ' + m.text;
  }).join('\n');
  /* END_PROBLEM_EXCLUDE */
}

module.exports = {
  renderMessages: renderMessages
};
