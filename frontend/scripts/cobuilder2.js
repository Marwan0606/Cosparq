// Prevent double-execution (“Identifier 'generatedHtml' has already been declared”)
let ideaId;

document.addEventListener('DOMContentLoaded', async () => {
  
  ideaId = JSON.parse(localStorage.getItem('ideaId'));
  console.log(ideaId)
  let db = await axios.get(`/api/save/saveCode/${ideaId}`);
  //let rec = db.data.codeResponse;
  if (db.data && db.data.codeResponse){
    console.log('getting from DB')

    window.location.href = '/code-preview.html';
  }
})

if (window.__cpv_init) {
  console.warn('codePreview already initialized');
} else {
  window.__cpv_init = true;

  axios.defaults.baseURL = 'http://localhost:5004';
  axios.defaults.withCredentials = true;

  let generatedHtml = '';
  let ideaId;

  const btn = document.querySelector('.js-enter-btn');
  btn.addEventListener('click', async () => {
    try {
      ideaId = JSON.parse(localStorage.getItem('ideaId'));
      console.log(ideaId)
      let db = await axios.get(`/api/save/saveCode/${ideaId}`);
      //let rec = db.data.codeResponse;
      if (db.data && db.data.codeResponse){
        console.log('getting from DB')

        window.location.href = '/code-preview.html';
      } else {
        const ideaResp = await axios.get(`/api/save/idea/${ideaId}`);
        const idea = ideaResp?.data?.idea?.idea;
        console.log('getting from AI')

        const userTextInput = document.querySelector('.js-user-text-inp').value

        // Make the API call FIRST to check subscription before navigating
        const gen = await axios.post('/api/responses/code', { idea, userTextInput, ideaId });
        const raw = gen?.data?.result || '';
        console.log(gen)

        generatedHtml = normalizeForPatch(unescapeGuards(cleanMarkdownFence(raw)));

        // save for next time (overwrite-or-create)
        await saveToDB(ideaId, generatedHtml);

        // Only navigate AFTER successful API call
        window.location.href = '/code-preview.html';
      }

    } catch (err) {
      console.error(err);
      // Don't navigate if there was an error (subscription popup will show)
    }
  });







  // ---------- helpers ----------
  // overwrite-or-create by ideaId
  async function saveToDB(ideaId, html) {
    try {
      await axios.put(`/api/save/saveCode/${ideaId}`, { codeFileResponse: html });
    } catch (e) {
      await axios.post('/api/save/saveCode', { ideaId, codeFileResponse: html });
    }
  }

  function cleanMarkdownFence(md = '') {
    return md
      .replace(/^\s*```(?:html)?\r?\n/, '')
      .replace(/\r?\n```\s*$/, '');
  }

  function unescapeGuards(s = '') {
    return s
      .replace(/\\x3C/gi, '<').replace(/\\x3E/gi, '>').replace(/\\x26/gi, '&')
      .replace(/\\u003c/gi, '<').replace(/\\u003e/gi, '>').replace(/\\u0026/gi, '&');
  }

  function normalizeForPatch(s = '') {
    return s.replace(/\r\n/g, '\n');
  }

  /*
  // ---------- patch button ----------
  document.getElementById('submit-btn').addEventListener('click', async () => {
    try {
      if (!previewEl) previewEl = document.getElementById('sitePreview');
      const instructions = document.getElementById('changeInput').value;
      console.log(instructions);

      const responseEdit = await axios.post('/api/responses/codeEdit', {
        originalFile: generatedHtml, // always patch from current
        instructions
      });

      const aiResult = responseEdit?.data?.result || '';
      console.log(aiResult);

      // If the model already returned a whole file, just use it.
      if (!isUnifiedDiff(aiResult)) {
        const maybeFile = extractFullFile(aiResult);
        if (maybeFile) {
          generatedHtml = normalizeForPatch(unescapeGuards(cleanMarkdownFence(maybeFile)));
          previewEl.srcdoc = generatedHtml;
          await saveToDB(ideaId, generatedHtml);
          console.log('✅ Applied full file (no diff).');
          return;
        }
      }

      // Try jsdiff if available
      if (window.Diff && typeof Diff.applyPatch === 'function') {
        try {
          const unified = toUnified(aiResult);
          const patched = Diff.applyPatch(generatedHtml, unified, { fuzzFactor: 2 });
          if (patched !== false) {
            generatedHtml = normalizeForPatch(patched);
            previewEl.srcdoc = generatedHtml;
            await saveToDB(ideaId, generatedHtml);
            console.log('✅ Patched with jsdiff');
            return;
          }
        } catch (e) {
          console.warn('jsdiff error:', e);
        }
      }

      // Try DMP if available
      if (window.diff_match_patch) {
        try {
          const dmp = new diff_match_patch();
          const dmpText = toDmpText(aiResult);
          const patches = dmp.patch_fromText(dmpText);
          const [patchedHtml, results] = dmp.patch_apply(patches, generatedHtml);
          generatedHtml = normalizeForPatch(patchedHtml);
          previewEl.srcdoc = generatedHtml;
          await saveToDB(ideaId, generatedHtml);
          if (!results.every(Boolean)) {
            console.warn('⚠️ Some hunks failed with DMP.');
          } else {
            console.log('✅ Patched with DMP');
            return;
          }
        } catch (e) {
          console.warn('DMP error:', e);
        }
      }

      // No patcher available or both failed → request a full file and swap
      console.warn('No patch library or patch failed; requesting full updated file…');
      generatedHtml = await requestFullFile(generatedHtml, instructions);
      previewEl.srcdoc = generatedHtml;
      await saveToDB(ideaId, generatedHtml);
      console.log('✅ Applied full-file fallback');
    } catch (err) {
      console.error(err);
    }
  });
  */
}