axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies


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

  const rec = db.data.codeResponse.codeFileResponse;
  console.log(rec);

  previewEl = document.getElementById('sitePreview');
  previewEl.srcdoc = rec;
}


getRaw();