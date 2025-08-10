// Simple hover tooltip for any element with data-tip-title / data-tip-body
(function () {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  function showTip(e) {
    const t = e.currentTarget;
    const title = t.getAttribute('data-tip-title') || '';
    const body  = t.getAttribute('data-tip-body') || '';
    if (!title && !body) return;

    tooltip.innerHTML = `
      <div class="t-title">${title}</div>
      <div class="t-body">${body}</div>
    `;
    tooltip.style.display = 'block';
    moveTip(e);
  }

  function moveTip(e) {
    const offset = 14;
    tooltip.style.top  = `${e.clientY + offset}px`;
    tooltip.style.left = `${e.clientX + offset}px`;
  }

  function hideTip() {
    tooltip.style.display = 'none';
  }

  // Delegate over likely interactive blocks
  const hovers = document.querySelectorAll(
    '[data-tip-title],[data-tip-body], .comp-card, .row, .verdict'
  );
  hovers.forEach(el => {
    el.addEventListener('mouseenter', showTip);
    el.addEventListener('mousemove', moveTip);
    el.addEventListener('mouseleave', hideTip);
  });
})();
