// Entry: wire up state, render, api (same roles as pain-01 — but via require()).
var state = require('./state');
var render = require('./render');
var api = require('./api');

window.APP = { state: state, render: render, api: api };

document.getElementById('send').addEventListener('click', function () {
  var input = document.getElementById('input');
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  api.sendUserMessage(text);
});
