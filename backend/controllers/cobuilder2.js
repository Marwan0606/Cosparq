const { kimi } = require('../services/kimiService');
const { trackApiUsage } = require('../services/apiUsageTracker');
const Cobuilder2Response = require('../models/Cobuilder2-response');

// ─── GENERATION ────────────────────────────────────────────────────────────────

const cobuilder2Generate = async (req, res) => {
  const userId = req.user.userId;
  const { idea, ideaId, preferences = {} } = req.body;
  const { colorScheme, style, additional } = preferences;

  // Check if there's already a pending or completed doc for this idea
  const existing = await Cobuilder2Response.findOne({ userId, ideaId }).sort({ updatedAt: -1 });
  if (existing && existing.status === 'pending') {
    return res.json({ status: 'pending', message: 'Generation already in progress' });
  }

  // Create or update DB record with pending status (upsert to prevent duplicates)
  let doc;
  try {
    doc = await Cobuilder2Response.findOneAndUpdate(
      { userId, ideaId },
      {
        $set: {
          status: 'pending',
          preferences: { colorScheme: colorScheme || '', style: style || '', additional: additional || '' }
        }
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('cobuilder2Generate: failed to create DB record', err);
    return res.status(500).json({ error: 'Database error' });
  }

  // ── Respond immediately — generation happens in background ──
  res.json({ status: 'pending', message: 'Generation started' });

  // ── Fire-and-forget: Kimi call runs independently of the HTTP request ──
  (async () => {
    try {
      // Build preference string
      let prefBlock = '';
      if (colorScheme) prefBlock += `\nColor scheme: ${colorScheme}`;
      if (style) prefBlock += `\nVisual style: ${style}`;
      if (additional) prefBlock += `\nAdditional instructions from user: ${additional}`;

      const systemPrompt = `You are an elite frontend developer and designer specializing in ultra-premium, award-winning landing pages. Generate a complete, self-contained, production-quality HTML landing page for the startup idea below.

DESIGN DIRECTION — PREMIUM & CINEMATIC:
- Dark, immersive design. Background: near-black (#08080a to #0c0c0e range).
- Animated ambient light effects using CSS keyframe animations:
  - Large blurred gradient orbs (position: fixed, border-radius: 50%, filter: blur(100-160px), opacity: 0.15-0.25) that slowly drift via @keyframes (translate transforms over 10-20s, ease-in-out, infinite).
  - Or subtle light streaks / aurora effects using animated gradient backgrounds.
  - These should create a living, breathing feel — like the premium sites from Framer, Linear, Vercel.
- Typography: Use a mix of a serif font (e.g., "Playfair Display" or "DM Serif Display" from Google Fonts) for hero headlines and a clean sans-serif (Inter) for body text. This creates a luxury editorial feel.
- Glassmorphic cards where appropriate: semi-transparent backgrounds (rgba(255,255,255,0.03-0.06)), subtle borders (rgba(255,255,255,0.06-0.1)), backdrop-filter: blur().
- Generous whitespace. Let the design breathe. Large padding between sections (100-140px vertical).
- Subtle CSS-only animations: fade-in and slide-up on scroll using IntersectionObserver in a small script. Elements start opacity:0, translateY(30px) and animate to visible.
- Single accent color derived from the user's chosen palette, used sparingly for CTAs and highlights.
- Subtle grid or dot pattern overlay (CSS background-image with radial-gradient) at very low opacity for texture.

CRITICAL CONTENT RULES (THIS IS A PRE-LAUNCH PRODUCT):
- This is an UNRELEASED product. There are NO existing users, NO reviews, NO testimonials, NO case studies.
- NEVER include: fake testimonials, fake reviews, fake user counts ("Join 10,000+ users"), fake company logos ("Trusted by"), star ratings, or any social proof that implies the product already has users.
- INSTEAD of social proof, use these pre-launch alternatives:
  - A compelling "Why this matters" or "The Problem" section explaining the pain point.
  - A "How it works" section (3-4 steps with icons).
  - A feature deep-dive section with detailed descriptions.
  - A "Built for" or "Who is this for" section describing target audience.
  - An optional FAQ section.
  - A countdown timer or "Coming Soon" badge to build anticipation.
- NEVER use emojis anywhere. Not in headings, not in body text, not in buttons, nowhere.
- For icons, use ONLY Lucide Icons via CDN (https://unpkg.com/lucide@latest). Use <i data-lucide="icon-name"></i> and initialize with lucide.createIcons() in the script. Choose professional, minimal icons.

WAITLIST FORM (PRIMARY CTA):
- Include a prominent "Join the Waitlist" form as the main call-to-action, placed in or near the hero section.
- The form must have:
  - Email input (type="email", placeholder "Enter your email")  
  - Submit button
  - The form element must have id="waitlistForm"
  - The email input must have id="waitlistEmail"
- On submit, the form JS should POST to the placeholder URL "__WAITLIST_ENDPOINT__" with JSON body { name: "", email: emailValue } and show a success message. Prevent default form submission.
- Style the form to be sleek and integrated — inline form (email + button side by side) or a minimal card.

STRUCTURE:
- Return ONLY the raw HTML. No markdown fences, no explanations, no backticks.
- All CSS in a single <style> tag in <head>. All JS in a single <script> tag before </body>.
- Include lucide CDN script: <script src="https://unpkg.com/lucide@latest"></script>
- Wrap sections in HTML comments: <!-- SECTION:hero --> ... <!-- /SECTION:hero --> etc.
- Sections to include: hero (headline + sub + waitlist CTA), features/how-it-works, problem/why, detail section, final CTA with waitlist form, footer.
- Fully responsive (mobile-first). No horizontal scroll. Clean on all screen sizes.
- All assets from CDNs only (Google Fonts, Lucide, etc). No local file references.
${prefBlock}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Startup idea:\n${idea}` }
      ];

      const response = await kimi.chat.completions.create({
        model: 'kimi-k2.5',
        messages,
      });

      let html = response.choices[0].message.content;
      html = cleanMarkdownFence(html);

      // Inject real waitlist endpoint into generated HTML
      html = injectWaitlistEndpoint(html, userId, ideaId);

      // Save as v1
      await Cobuilder2Response.findByIdAndUpdate(doc._id, {
        status: 'success',
        currentVersion: 1,
        $push: {
          versions: {
            versionNumber: 1,
            code: html,
            description: 'Initial generation',
            createdAt: new Date()
          }
        }
      });

      console.log(`cobuilder2Generate: SUCCESS for ideaId=${ideaId}`);

      // Track usage
      try { await trackApiUsage(userId, response, 'cobuilder2Generate'); } catch (_) {}
    } catch (err) {
      console.error('cobuilder2Generate background error:', err);
      await Cobuilder2Response.findByIdAndUpdate(doc._id, { status: 'error' }).catch(() => {});
    }
  })();
};

// ─── EDITING (search-and-replace diffs) ────────────────────────────────────────

const cobuilder2Edit = async (req, res) => {
  const userId = req.user.userId;
  const { instructions, currentCode, ideaId } = req.body;

  // Set pending
  const doc = await Cobuilder2Response.findOneAndUpdate(
    { userId, ideaId },
    { status: 'pending' },
    { new: true }
  );

  if (!doc) {
    return res.status(404).json({ error: 'No CoBuilder 2 project found' });
  }

  // ── Respond immediately ──
  res.json({ status: 'pending', message: 'Edit in progress' });

  // ── Fire-and-forget: edit runs in background ──
  (async () => {
    try {
      const systemPrompt = `You are an expert web developer editing an existing HTML landing page.
The user will give you the FULL current HTML file and their change request.

You MUST return ONLY search-and-replace blocks in this exact format:

<<<<<<< SEARCH
exact lines from the original code that need to change
=======
the replacement lines
>>>>>>> REPLACE

Rules:
- The SEARCH block must be an EXACT substring of the current file (whitespace-sensitive).
- Include enough context in SEARCH to be unambiguous (3-5 lines minimum).
- You can output multiple SEARCH/REPLACE blocks if the change touches multiple areas.
- Do NOT output the full file. Do NOT add any explanation text.
- Do NOT wrap output in markdown code fences.
- If the change requires adding a completely new section, use a SEARCH block that contains the lines BEFORE where the new content should be inserted, and include those lines plus the new content in the REPLACE block.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `CURRENT HTML FILE:\n\n${currentCode}\n\n---\n\nCHANGE REQUEST: ${instructions}` }
      ];

      const response = await kimi.chat.completions.create({
        model: 'kimi-k2.5',
        messages,
      });

      const aiOutput = response.choices[0].message.content;

      // Parse and apply diffs
      let updatedCode = applySearchReplaceDiffs(currentCode, aiOutput);

      // If no diffs were found/applied, try treating the response as a full file
      if (updatedCode === null) {
        const extracted = extractFullFile(aiOutput);
        if (extracted) {
          updatedCode = extracted;
        } else {
          // Fallback: use cheap moonshot-v1-8k to regenerate the full file
          updatedCode = await cheapFullRewrite(currentCode, instructions);
        }
      }

      // Reload doc fresh from DB (in case of concurrent edits)
      const freshDoc = await Cobuilder2Response.findOne({ userId, ideaId });
      const nextVersion = (freshDoc.versions.length || 0) + 1;

      freshDoc.versions.push({
        versionNumber: nextVersion,
        code: updatedCode,
        description: instructions.slice(0, 200),
        createdAt: new Date()
      });
      freshDoc.currentVersion = nextVersion;
      freshDoc.status = 'success';

      // Keep max 30 versions
      if (freshDoc.versions.length > 30) {
        freshDoc.versions.splice(1, freshDoc.versions.length - 30);
      }

      await freshDoc.save();
      console.log(`cobuilder2Edit: SUCCESS v${nextVersion} for ideaId=${ideaId}`);

      try { await trackApiUsage(userId, response, 'cobuilder2Edit'); } catch (_) {}
    } catch (err) {
      console.error('cobuilder2Edit background error:', err);
      await Cobuilder2Response.findOneAndUpdate({ userId, ideaId }, { status: 'error' }).catch(() => {});
    }
  })();
};

// ─── HELPERS ────────────────────────────────────────────────────────────────────

function applySearchReplaceDiffs(original, aiOutput) {
  // Parse all <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE blocks
  const diffRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  const diffs = [];
  let match;

  while ((match = diffRegex.exec(aiOutput)) !== null) {
    diffs.push({ search: match[1], replace: match[2] });
  }

  if (diffs.length === 0) return null;

  let result = original;
  let allApplied = true;

  for (const diff of diffs) {
    // Try exact match first
    if (result.includes(diff.search)) {
      result = result.replace(diff.search, diff.replace);
    } else {
      // Fuzzy: try trimming each line and matching
      const trimmedSearch = diff.search.split('\n').map(l => l.trim()).join('\n');
      const trimmedOriginal = result.split('\n').map(l => l.trim()).join('\n');

      const idx = trimmedOriginal.indexOf(trimmedSearch);
      if (idx !== -1) {
        // Find corresponding line range in original
        const beforeTrimmed = trimmedOriginal.slice(0, idx);
        const startLine = beforeTrimmed.split('\n').length - 1;
        const searchLineCount = trimmedSearch.split('\n').length;

        const lines = result.split('\n');
        const before = lines.slice(0, startLine);
        const after = lines.slice(startLine + searchLineCount);
        result = [...before, diff.replace, ...after].join('\n');
      } else {
        console.warn('cobuilder2Edit: Could not apply diff block, search text not found');
        allApplied = false;
      }
    }
  }

  return result;
}

function extractFullFile(text) {
  // Check if the AI returned a full HTML file instead of diffs
  const cleaned = cleanMarkdownFence(text);
  if (cleaned.includes('<!DOCTYPE html>') || cleaned.includes('<html')) {
    return cleaned;
  }
  return null;
}

async function cheapFullRewrite(currentCode, instructions) {
  // Fallback: use the cheapest Kimi model to apply the edit as a full rewrite
  try {
    const response = await kimi.chat.completions.create({
      model: 'moonshot-v1-8k',
      messages: [
        {
          role: 'system',
          content: 'You are a web developer. Apply the requested changes to the HTML file. Return ONLY the complete updated HTML file. No markdown fences, no explanation.'
        },
        {
          role: 'user',
          content: `CURRENT HTML:\n\n${currentCode}\n\n---\n\nCHANGES: ${instructions}`
        }
      ]
    });

    let result = response.choices[0].message.content;
    return cleanMarkdownFence(result);
  } catch (err) {
    console.error('cheapFullRewrite fallback failed:', err);
    // Return original code unchanged rather than crashing
    return currentCode;
  }
}

function cleanMarkdownFence(text) {
  if (!text) return text;
  // Remove leading ```html and trailing ```
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:html|HTML)?\s*\n?/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

/**
 * Replace the __WAITLIST_ENDPOINT__ placeholder (or inject the waitlist script entirely)
 * so the generated page always POSTs to the correct public API.
 */
function injectWaitlistEndpoint(html, userId, ideaId) {
  const appBase = process.env.APP_BASE_URL || '';
  const endpoint = `${appBase}/api/waitlist/submit/${userId}/${ideaId}`;

  // Already injected? Skip.
  if (html.includes('/api/waitlist/submit/')) return html;

  // 1. Replace placeholder if AI used it
  if (html.includes('__WAITLIST_ENDPOINT__')) {
    return html.replace(/__WAITLIST_ENDPOINT__/g, endpoint);
  }

  // 2. Generic injection: find ALL forms with an email input and override their submit
  //    This works regardless of what IDs the AI chose.
  const waitlistScript = `
<!-- COSPARQ WAITLIST -->
<script>
(function() {
  var forms = document.querySelectorAll('form');
  forms.forEach(function(form) {
    var emailInput = form.querySelector('input[type="email"]');
    if (!emailInput) return;

    // Remove any existing submit listeners by cloning
    var newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    emailInput = newForm.querySelector('input[type="email"]');

    newForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var nameInput = newForm.querySelector('input[type="text"]');
      var btn = newForm.querySelector('button[type="submit"], button');
      var origText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Joining...'; btn.disabled = true; }

      try {
        var res = await fetch('${endpoint}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput ? nameInput.value : '',
            email: emailInput.value
          })
        });
        var data = await res.json();
        if (btn) btn.textContent = data.message || "You're on the waitlist!";
        emailInput.value = '';
        if (nameInput) nameInput.value = '';
      } catch (err) {
        if (btn) { btn.textContent = 'Something went wrong'; }
      }
      setTimeout(function() {
        if (btn) { btn.textContent = origText; btn.disabled = false; }
      }, 3000);
    });
  });
})();
</script>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', waitlistScript + '\n</body>');
  }
  return html + waitlistScript;
}

module.exports = { cobuilder2Generate, cobuilder2Edit, injectWaitlistEndpoint };
