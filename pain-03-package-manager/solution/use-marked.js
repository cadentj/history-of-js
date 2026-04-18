var marked = require('marked');

function renderMarkdown(md) {
  /* BEGIN_PROBLEM_EXCLUDE */
  return marked.parse(md);
  /* END_PROBLEM_EXCLUDE */
}

module.exports = { renderMarkdown: renderMarkdown };
