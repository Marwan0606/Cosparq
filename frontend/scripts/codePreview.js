axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies


// Wait until the document is parsed
document.addEventListener('DOMContentLoaded', async () => {
  let generatedHtml = ''


  let ideaId = JSON.parse(localStorage.getItem('ideaId'))
  let idea = await axios.get(`/api/save/idea/${ideaId}`)
  idea = idea.data.idea.idea

  let getDB = await axios.get(`/api/save/saveCode/${ideaId}`)
  getDB = getDB.data.codeResponse
  console.log(getDB)
  if (!getDB) {
    //let response = await axios.post('/api/responses/code', {idea})
    console.log(response)
    generatedHtml = cleanMarkdownFence(response.data.result)
    let save = await axios.post('/api/save/saveCode', {codeFileResponse: generatedHtml, ideaId})
  } else {
    generatedHtml = cleanMarkdownFence(getDB.codeFileResponse)
  }

    


  // 2) Find the iframe
  const previewEl = document.getElementById('sitePreview');
  if (!previewEl) {
    console.error('⚠️ iframe#sitePreview not found');
    return;
  }

  // 3) Inject your generated code
  previewEl.srcdoc = generatedHtml;
});




function cleanMarkdownFence(md) {
  return md
    // remove opening ``` or ```html
    .replace(/^```(?:html)?\r?\n/, '')
    // remove closing ```
    .replace(/\r?\n```$/, '');
}

