// set-axios-defaults.js
const token = localStorage.getItem('accessToken');

if (!token) {
  window.location.href = 'auth.html';
} else {
  axios.defaults.baseURL = 'http://localhost:5004';
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}



// scripts/sidebar.js
export async function initSidebar() {
  console.log('initsidebar ran')
  // hook up the open/close button
  const sidebar = document.getElementById('sidebar');
  const btn = document.querySelector('.js-menu-button');
  if (btn && sidebar) {
    btn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !e.target.closest('.js-menu-button')) {
        sidebar.classList.remove('open');
      }
    });
  }

  // then populate the Ideas list
  await populateIdeas();
  highlightActiveLink();
}





async function populateIdeas() {
  try {
    console.log('populateIdeas ran')
    console.log('Requesting ideas with header:', axios.defaults.headers.common.Authorization);
    // 1) Fetch _all_ ideas for the authenticated user; no userId in the path
    const { data } = await axios.get('/api/save/ideas');
    console.log(data)
    const ideas = Array.isArray(data.idea) ? data.idea : [];

    // 2) Render into the sidebar menu
    const menu = document.querySelector('#sidebar .js-menu');
    if (!menu) {
      console.warn('No .js-menu element found');
      return;
    }

    menu.innerHTML = ideas
      .map(i => `
        <a 
          href="/scoreboard-page.html" 
          data-product-id="${i._id}" 
          class="menu-item menu-item-ideas"
        >
          ${i.ideaName}
        </a>
      `)
      .join('');

    // 3) Hook up click handlers & highlight
    document.querySelectorAll('.menu-item-ideas').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const ideaId = link.dataset.productId;
        localStorage.setItem('ideaId', JSON.stringify(ideaId));
        window.location.href = link.href;
      });
    });

    highlightActiveLink();

  } catch (error) {
    if (error.response?.status === 403) {
      const refreshToken = localStorage.getItem('refreshToken');
      console.log(refreshToken)
      const response = await axios.post('http://localhost:4004/token', {token: refreshToken})
      let newToken = response.data.accessToken;

      localStorage.setItem('accessToken', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      console.log(`new access token: ${newToken}`)
      initSidebar()
      return location.reload();
    }
    //console.error('populateIdeas error:', error);
    
  }
}













/*
let generateIdeasSideBar = async ()=>{
  try {

    let user = JSON.parse(localStorage.getItem('user'))
    let userId = user.data.user._id
    console.log(userId)


    let ideas = await axios.get(`/api/save/ideas/${userId}`)
    ideas = ideas.data.idea

    let HTML = generateHTML(ideas)
    document.querySelector('.js-menu').innerHTML = HTML


    document.querySelectorAll('.menu-item-ideas').forEach((link)=>{
      link.addEventListener('click', (e) => {
        e.preventDefault(); // ensure we can read/save before navigating
        const ideaId = link.dataset.productId; // fixed: use the correct variable
        console.log(`The button clicked has an ideaId of ${ideaId}`);
        localStorage.setItem('ideaId', JSON.stringify(ideaId)); // store for next page

        document.querySelectorAll('.menu-item-ideas').forEach(a => a.classList.remove('active'));
        link.classList.add('active');

        window.location.href = link.href; // then navigate
        
      })
    })
    highlightActiveLink();
  } catch (error) {
    console.log(error)
  }
}


function generateHTML(ideas) {
  let HTML = ``
  ideas.forEach((idea)=>{
    console.log(`Idea Name: ${idea.ideaName}`)
    HTML += `
      <a href="/scoreboard-page.html" data-product-id="${idea._id}" class="menu-item menu-item-ideas">${idea.ideaName}</a>
    `
  })
  return HTML;
}

generateIdeasSideBar()
*/

function highlightActiveLink() {
  const path = location.pathname.replace(/\/+$/, '');

  // ---- 1) WORKFLOW SECTION ONLY (exclude the Ideas list .js-menu) ----
  const workflowLinks = document.querySelectorAll('#sidebar nav.menu:not(.js-menu) .menu-item');

  // Clear active on workflow links
  workflowLinks.forEach(a => a.classList.remove('active'));

  // URL-based highlight for workflow links (skip placeholders/muted)
  workflowLinks.forEach(link => {
    const rawHref = link.getAttribute('href') || '';
    if (link.classList.contains('muted')) return;
    if (!rawHref || rawHref === '#' || rawHref.startsWith('javascript:')) return;

    const hrefPath = new URL(link.href, location.origin).pathname.replace(/\/+$/, '');
    if (hrefPath === path) link.classList.add('active');
  });

  // ---- 2) IDEAS SECTION: highlight ONLY the stored ideaId ----
  const ideaLinks = document.querySelectorAll('#sidebar .js-menu .menu-item-ideas');
  ideaLinks.forEach(a => a.classList.remove('active'));

  const selectedId = JSON.parse(localStorage.getItem('ideaId') || 'null');
  if (selectedId) {
    const activeIdea = document.querySelector(
      `#sidebar .js-menu .menu-item-ideas[data-product-id="${selectedId}"]`
    );
    if (activeIdea) activeIdea.classList.add('active');
  }
}

