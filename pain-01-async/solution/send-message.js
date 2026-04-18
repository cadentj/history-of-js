// Pain 1: callback -> Promise -> async/await.

function sendWithXhr(text, done, fail) {
  /* BEGIN_PROBLEM_EXCLUDE */
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/chat');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function () {
    if (xhr.status !== 200) {
      fail(new Error(xhr.statusText || 'Request failed'));
      return;
    }
    done(JSON.parse(xhr.responseText));
  };
  xhr.onerror = function () { fail(new Error('Network error')); };
  xhr.send(JSON.stringify({ text: text }));
  /* END_PROBLEM_EXCLUDE */
}

function sendWithPromise(text) {
  /* BEGIN_PROBLEM_EXCLUDE */
  return fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  }).then(function (res) {
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    return res.json();
  });
  /* END_PROBLEM_EXCLUDE */
}

async function sendWithAsyncAwait(text) {
  /* BEGIN_PROBLEM_EXCLUDE */
  var res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  });

  if (!res.ok) {
    throw new Error('HTTP ' + res.status);
  }

  return res.json();
  /* END_PROBLEM_EXCLUDE */
}
