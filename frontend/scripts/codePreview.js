// Prevent double-execution (“Identifier 'generatedHtml' has already been declared”)
if (window.__cpv_init) {
  console.warn('codePreview already initialized');
} else {
  window.__cpv_init = true;

  axios.defaults.baseURL = 'http://localhost:5004';
  axios.defaults.withCredentials = true;

  let generatedHtml = '';
  let previewEl;
  let ideaId;

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      ideaId = JSON.parse(localStorage.getItem('ideaId'));
      console.log(ideaId)
      let db = await axios.get(`/api/save/saveCode/${ideaId}`);
      let rec = db.data.codeResponse;
      if (db.data && db.data.codeResponse){
        console.log('getting from DB')
        rec = db.data.codeResponse;
        while (!rec) {
          db = await axios.get(`/api/save/saveCode/${ideaId}`);
          rec = db.data.codeResponse;

          if (!rec) {
            await new Promise(resolve => setTimeout(resolve, 5000))
          }
        }
        generatedHtml = normalizeForPatch(unescapeGuards(cleanMarkdownFence(rec.codeFileResponse)));
      } else {
        const ideaResp = await axios.get(`/api/save/idea/${ideaId}`);
        const idea = ideaResp?.data?.idea?.idea;
        console.log('getting from AI')
        const gen = await axios.post('/api/responses/code', { idea, ideaId });
        const raw = gen?.data?.result || '';
        console.log(gen)

        generatedHtml = normalizeForPatch(unescapeGuards(cleanMarkdownFence(raw)));

        // save for next time (overwrite-or-create)
        await saveToDB(ideaId, generatedHtml);
      }

      previewEl = document.getElementById('sitePreview');
      if (!previewEl) {
        console.error('⚠️ iframe#sitePreview not found');
        return;
      }
      previewEl.srcdoc = generatedHtml;
    } catch (err) {
      console.error(err);
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

  function isUnifiedDiff(s = '') {
    const t = String(s);
    return t.includes('@@') || t.includes('*** Begin Patch') || /^[ +-]/m.test(t);
  }

  function extractFullFile(s = '') {
    const fence = s.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
    if (fence) return fence[1];
    if (/<html[\s>]/i.test(s)) return s;
    return null;
  }

  function toUnified(aiDiff) {
    const lines = String(aiDiff).replace(/\r/g, '').split('\n');
    const out = [];
    for (let line of lines) {
      if (line.startsWith('***')) continue;
      if (line === '@@') line = '@@ -1,0 +1,0 @@';
      if (line.startsWith('@@') || /^[ +-]/.test(line)) out.push(line);
    }
    if (!out.length) throw new Error('No diff hunks found');
    return `--- a/index.html
+++ b/index.html
${out.join('\n')}\n`;
  }

  function toDmpText(aiDiff) {
    const lines = String(aiDiff).replace(/\r/g, '').split('\n');
    const out = [];
    for (let line of lines) {
      if (line.startsWith('***')) continue;
      if (line === '@@') line = '@@ -1,0 +1,0 @@';
      if (line.startsWith('@@')) out.push(line);
      else if (/^[ +-]/.test(line)) out.push(line[0] + encodeURI(line.slice(1)));
    }
    return out.join('\n');
  }

  async function requestFullFile(originalFile, instructions) {
    const resp = await axios.post('/api/responses/codeEditCheap', {
      originalFile,
      instructions
    });
    console.log(resp)
    const raw = resp?.data?.result || '';
    const full = extractFullFile(raw) || raw;
    //if (!/<html[\s>]/i.test(full)) throw new Error('Full-file fallback did not return an HTML document.');
    return normalizeForPatch(unescapeGuards(cleanMarkdownFence(full)));
  }

  // ---------- patch button ----------
  document.getElementById('submit-btn').addEventListener('click', async () => {
    try {
      if (!previewEl) previewEl = document.getElementById('sitePreview');
      const instructions = document.getElementById('changeInput').value;
      console.log(instructions);

      const responseEdit = await axios.post('/api/responses/codeEdit', {
        originalFile: generatedHtml, // always patch from current
        instructions,
        ideaId
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
}


document.getElementById('raw-file').addEventListener('click', ()=>{
  window.location = '/getRawCode.html'
})

document.getElementById('full-preview').addEventListener('click', ()=>{
  window.location = '/fullPreview.html'
})