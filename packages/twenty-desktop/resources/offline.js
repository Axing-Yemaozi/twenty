const searchParameters = new URLSearchParams(window.location.search);
const serverUrl = searchParameters.get('serverUrl');
const errorDescription = searchParameters.get('errorDescription');
const retryButton = document.querySelector('#retry-button');
const serverAddress = document.querySelector('#server-address');
const errorDetail = document.querySelector('#error-detail');
const retryConnection = () => {
  if (serverUrl) {
    window.location.replace(serverUrl);
  }
};

if (serverUrl) {
  try {
    serverAddress.textContent = new URL(serverUrl).origin;
  } catch {
    serverAddress.textContent = '';
  }
}

errorDetail.textContent = errorDescription || 'The server did not respond.';

retryButton.addEventListener('click', retryConnection);

if (serverUrl) {
  window.setTimeout(retryConnection, 10_000);
}
