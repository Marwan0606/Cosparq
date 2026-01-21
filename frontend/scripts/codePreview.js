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
      if (db.data.codeResponse.status == "pending"){
        await loadingAnimation(true);
      }
      if (db.data && db.data.codeResponse){
        console.log('getting from DB')
        rec = db.data.codeResponse;
        let status = db.data.codeResponse.status
        while (status=="pending") {
          console.log(status)
          db = await axios.get(`/api/save/saveCode/${ideaId}`);
          rec = db.data.codeResponse;
          status = db.data.codeResponse.status

          if (status=="pending") {
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
      await loadingAnimation(false);
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

      await loadingAnimation(true);
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
          //await saveToDB(ideaId, generatedHtml);
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
            //await saveToDB(ideaId, generatedHtml);
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
          //await saveToDB(ideaId, generatedHtml);
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
      //await saveToDB(ideaId, generatedHtml);
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







//To load the loading animation

async function loadingAnimation(show = true) {
  const overlay = document.getElementById('loaderOverlay');
  if (!overlay) return;

  if (!show) {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
    return;
  }

  overlay.classList.remove('hidden');
  overlay.innerHTML = `
        <div class="frame">
        <div class="brand-wrap">
          <div class="brand">Your AI is Making Your Website</div>
          <!--<div class="new dotting"></div>-->
        </div>

        <div class="viz">
          <svg viewBox="0 0 800 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"  stop-color="#8400ff"/>
                <stop offset="40%" stop-color="#f94016"/>
                <stop offset="60%" stop-color="#f96d16"/>
                <stop offset="100%" stop-color="#3b82f6"/>
              </linearGradient>
            </defs>

            <!-- Links -->
            <g id="links">
              <line class="link" data-a="n1"  data-b="n5" x1="130" y1="90"  x2="320" y2="130"/>
              <line class="link" data-a="n5"  data-b="n6" x1="320" y1="130" x2="410" y2="90"/>
              <line class="link" data-a="n6"  data-b="c"  x1="410" y1="90"  x2="400" y2="260"/>
              <line class="link" data-a="n2"  data-b="n5" x1="120" y1="250" x2="320" y2="130"/>
              <line class="link" data-a="n2"  data-b="c"  x1="120" y1="250" x2="400" y2="260"/>
              <line class="link" data-a="n3"  data-b="c"  x1="160" y1="400" x2="400" y2="260"/>
              <line class="link" data-a="n4"  data-b="c"  x1="300" y1="460" x2="400" y2="260"/>
              <line class="link" data-a="n7"  data-b="c"  x1="650" y1="110" x2="400" y2="260"/>
              <line class="link" data-a="n7"  data-b="n8" x1="650" y1="110" x2="720" y2="240"/>
              <line class="link" data-a="n8"  data-b="n9" x1="720" y1="240" x2="620" y2="370"/>
              <line class="link" data-a="n9"  data-b="c"  x1="620" y1="370" x2="400" y2="260"/>
              <line class="link" data-a="n10" data-b="c"  x1="470" y1="470" x2="400" y2="260"/>
            </g>

            <!-- Nodes -->
            <g id="nodes">
              <circle id="n1"  class="node" cx="130" cy="90"  r="7"/>
              <circle id="n2"  class="node" cx="120" cy="250" r="7"/>
              <circle id="n3"  class="node" cx="160" cy="400" r="7"/>
              <circle id="n4"  class="node" cx="300" cy="460" r="7"/>
              <circle id="n5"  class="node" cx="320" cy="130" r="7"/>
              <circle id="n6"  class="node" cx="410" cy="90"  r="7"/>
              <circle id="n7"  class="node" cx="650" cy="110" r="7"/>
              <circle id="n8"  class="node" cx="720" cy="240" r="7"/>
              <circle id="n9"  class="node" cx="620" cy="370" r="7"/>
              <circle id="n10" class="node" cx="470" cy="470" r="7"/>
              <circle id="c"   class="node center" cx="400" cy="260" r="9"/>
            </g>
          </svg>
        </div>

        <!-- Bottom-right status -->
        <div class="status dotting">Loading</div>
  `;

  const { startLoadingAnimation } = await import('../scripts/loading.js'); 

  startLoadingAnimation(overlay);
}
