axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies


let lastFetchedCode = '';

async function getRaw() {
  const ideaId = JSON.parse(localStorage.getItem('ideaId'));
  let db=''
  try {
    db = await axios.get(`/api/save/saveCode/${ideaId}`);
  } catch (error) {
    if (error.response.status === 401 || error.response.status === 403) {
      try {
        // 1) Refresh via cookie (no body needed)
        await axios.post('http://localhost:4004/token', {}, { withCredentials: true });
        // 2) Retry original fetch
        initSidebar();
        return location.reload();
      } catch {
        // Refresh failed → force login
        return window.location.href = 'auth.html';
      }
    }
  }

  const rec    = db.data.codeResponse.codeFileResponse;
  console.log(rec);

  lastFetchedCode = rec;

  document.querySelector('.js-rawHtml').textContent = rec;
}

document.querySelector('.js-copyBtn').addEventListener('click', async () => {
    if (!lastFetchedCode) {
      alert('Nothing to copy yet!');
      return;
    }
    try {
      await navigator.clipboard.writeText(lastFetchedCode);
      document.querySelector('.js-copyBtn').textContent = 'Copied!';
      setTimeout(() => {
        document.querySelector('.js-copyBtn').textContent = 'Copy Code';
      }, 1500);
    } catch (err) {
      console.error('Copy failed', err);
      alert('Copy failed — your browser may not support the Clipboard API.');
    }
  });


getRaw();
