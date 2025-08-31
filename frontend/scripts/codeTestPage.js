// diffPatch.js

// 1️⃣ Your “current” HTML
/*
let currentHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My Test Page</title>
    <style>
      :root {
        --brand-color: #0000ff;
      }
      body {
        margin: 0;
        font-family: sans-serif;
        background: var(--brand-color);
      }
      h1 {
        color: white;
        text-align: center;
        padding: 2rem;
      }
    </style>
  </head>
  <body>
    <h1>Welcome to my page</h1>
    <p>This is some sample content.</p>
  </body>
</html>`;
*/

const getFile = async ()=>{
  try {
    let response = await axios.post('/api/responses/code', {link: "https://cluely.com/"})
    console.log(response)
    let file = response.data.result
    console.log(file)
    let currentHtml = file



    // 2️⃣ Render it to your preview textarea
    const previewEl = document.getElementById('codePreview');
    previewEl.value = currentHtml;





    let responseEdit = await axios.post('/api/responses/codeEdit', {originalFile: currentHtml, instructions: "Change the background color of the page to red"})
    // 3️⃣ AI‐generated unified diff with three hunks
    const aiDiff = responseEdit.data.result
    console.log(aiDiff)


    /*
    const aiDiff = `*** Begin Patch
    *** Update File: index.html
    @@ -5,7 +5,7 @@
          :root {
    -        --brand-color: #0000ff;
    +        --brand-color: #ff0000;
          }
    @@ -8,7 +8,7 @@
          body {
            margin: 0;
            font-family: sans-serif;
    -        background: var(--brand-color);
    +        background: #ffffff;
          }
    @@ -11,7 +11,7 @@
          h1 {
    -        color: white;
    +        color: #000000;
            text-align: center;
            padding: 2rem;
          }
    *** End Patch`;
    */

    // ────────────────────────────────────────────────────────────────────────────
    // Helper: remove the smallest common indent from every non-blank line
    function normalizeIndent(text) {
      const lines = text.split('\n');
      const indents = lines
        .filter(l => l.trim())
        .map(l => (l.match(/^ */) || [''])[0].length);
      const minIndent = indents.length ? Math.min(...indents) : 0;
      return lines.map(l => l.slice(minIndent)).join('\n');
    }

    // 4️⃣ Extract only the diff hunks
    const hunkLines = aiDiff
      .split('\n')
      .filter(line =>
        line.startsWith('@@') ||
        line.startsWith('+')  ||
        line.startsWith('-')  ||
        line.startsWith(' ')
      )
      .join('\n');

    // 5️⃣ Normalize both current HTML and diff
    const normHtml = normalizeIndent(currentHtml);
    const normDiff = normalizeIndent(hunkLines);

    // 6️⃣ Create the diff-match-patch instance
    const dmp = new diff_match_patch();

    // 7️⃣ Parse the normalized unified diff
    let patches;
    try {
      patches = dmp.patch_fromText(normDiff);
    } catch (e) {
      console.error('Failed to parse diff:', e);
      throw e;
    }

    // 8️⃣ Apply the patches
    const [newNormHtml, results] = dmp.patch_apply(patches, normHtml);

    // 9️⃣ Verify and update preview
    if (results.every(Boolean)) {
      currentHtml = newNormHtml;
      previewEl.value = currentHtml;
      console.log('✅ Patched HTML:', currentHtml);
    } else {
      console.error('⚠️ Some hunks failed to apply:', results);
    }

    console.log('Patch objects:', patches);
    console.log('Normalized diff:\n', normDiff);

  } catch (error) {
    console.log(error)
  }
}

getFile()