const { openai } = require('../services/openaiService');
const { trackApiUsage } = require('../services/apiUsageTracker');
const codeResponseModel = require('../models/Code-response');
const Diff = require('diff');

const codeEdit = async (req, res) => {
  const { instructions, originalFile, ideaId } = req.body;
  const userId = req.user?.userId; // Get userId if available

  // Set status to pending at the start
  if (ideaId) {
    try {
      await codeResponseModel.findOneAndUpdate(
        { ideaId },
        { status: 'pending' },
        { new: true, upsert: true }
      );
      console.log('⏳ Status set to pending for ideaId:', ideaId);
    } catch (statusErr) {
      console.error('⚠️ Failed to set pending status:', statusErr);
    }
  }

  const messages = [
    {
      role: "system",
      content: `
        You are given this HTML file with CSS and Javascript too:
        ${originalFile}


        Your task is to apply the user's instruction and output only the patch in unified-diff (git) format.

Do not reprint any of the original file contents—output nothing but the diff, e.g.:

*** Begin Patch
*** Update File: index.html
@@ -10,7 +10,7 @@
-  background: #0000ff;
+  background: #ff0000;
*** End Patch


Make sure your diff:

Uses normal @@ -start,count +start,count @@ hunk headers

Prefixes removed lines with -, added lines with +, and context lines with a single space

Includes no extra commentary, markdown fences, or wrapping-text just the raw diff.


        Please output *only* a unified-diff patch (git format) that makes the user's instruction happen:
        > ${instructions}

      `
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages,
    });

    // Track API usage for first call
    if (userId) {
      await trackApiUsage(userId, response, 'codeEdit');
    }

    const aiResult = response.choices[0].message.content;
    let finalFile = originalFile; // Default to original
    let patchApplied = false;

    // Try to apply patch if it's a diff
    if (isUnifiedDiff(aiResult)) {
      try {
        const unified = toUnified(aiResult);
        const patched = Diff.applyPatch(originalFile, unified, { fuzzFactor: 2 });
        
        if (patched !== false) {
          finalFile = normalizeForPatch(patched);
          patchApplied = true;
          console.log('✅ Patch applied successfully on backend');
        } else {
          console.warn('⚠️ Diff.applyPatch returned false - patch failed');
        }
      } catch (patchErr) {
        console.warn('⚠️ Patch application failed:', patchErr.message);
      }
    } else {
      // If it's a full file response, extract it
      const maybeFile = extractFullFile(aiResult);
      if (maybeFile) {
        finalFile = normalizeForPatch(unescapeGuards(cleanMarkdownFence(maybeFile)));
        patchApplied = true;
        console.log('✅ Full file extracted from response');
      }
    }

    // FALLBACK: If patch failed, request full file from AI
    if (!patchApplied) {
      console.warn('🔄 Patch failed - requesting full file from AI...');
      try {
        const fullFileResponse = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: `You are given this HTML file:
${originalFile}

Apply this instruction and return the COMPLETE updated HTML file (not a diff):
> ${instructions}

Return only the full HTML file with no markdown fences or explanations.`
            }
          ],
        });

        // Track API usage for fallback call
        if (userId) {
          await trackApiUsage(userId, fullFileResponse, 'codeEdit-fallback');
        }

        const fullFileResult = fullFileResponse.choices[0].message.content;
        const extractedFile = extractFullFile(fullFileResult) || fullFileResult;
        finalFile = normalizeForPatch(unescapeGuards(cleanMarkdownFence(extractedFile)));
        console.log('✅ Full file fallback successful');
      } catch (fallbackErr) {
        console.error('❌ Full file fallback also failed:', fallbackErr.message);
        // Keep original file if everything fails
      }
    }

    // Save to database with status 'success'
    if (ideaId) {
      try {
        await codeResponseModel.findOneAndUpdate(
          { ideaId },
          { 
            codeFileResponse: finalFile,
            status: 'success'
          },
          { new: true, upsert: true }
        );
        console.log('✅ Code saved to DB with success status for ideaId:', ideaId);
      } catch (dbErr) {
        console.error('⚠️ Database save failed:', dbErr);
      }
    }

    // Return the original AI result (not the final file) so frontend can handle its own preview
    res.json({ result: aiResult });
  } catch (err) {
    console.error(err);
    
    // Set status to 'error' if something goes wrong
    if (ideaId) {
      try {
        await codeResponseModel.findOneAndUpdate(
          { ideaId },
          { status: 'error' },
          { new: true, upsert: true }
        );
        console.log('❌ Status set to error for ideaId:', ideaId);
      } catch (statusErr) {
        console.error('⚠️ Failed to set error status:', statusErr);
      }
    }
    
    res.status(500).json({ error: 'Failed to fetch AI response.' });
  }
};

// Helper functions
function isUnifiedDiff(s = '') {
  const t = String(s);
  return t.includes('@@') || t.includes('*** Begin Patch') || /^[ +-]/m.test(t);
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

function extractFullFile(s = '') {
  const fence = s.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
  if (fence) return fence[1];
  if (/<html[\s>]/i.test(s)) return s;
  return null;
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

module.exports = { codeEdit };