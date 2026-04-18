(function () {
  var container = document.getElementById('messages');

  function renderAll() {
    /* BEGIN_PROBLEM_EXCLUDE */
    var list = window.APP.state.getMessages();
    container.innerHTML = list.map(function (item) {
      return '<div><strong>' + item.role + '</strong>: ' + item.text + '</div>';
    }).join('');
    /* END_PROBLEM_EXCLUDE */
  }

  window.APP.render = { renderAll: renderAll };
})();
