// scripts/sidebar.js
export async function initSidebar() {
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
}

async function populateIdeas() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    const userId = user?.data?.user?._id;
    if (!userId) {
      console.warn('No userId in localStorage');
      return;
    }

    const { data } = await axios.get(`/api/save/ideas/${userId}`);
    const ideas = data?.idea ?? [];

    const menu = document.querySelector('#sidebar .js-menu');
    if (!menu) {
      console.warn('No .js-menu element found');
      return;
    }

    menu.innerHTML = ideas
      .map(i => `<a href="/dashboard-idea1.html" class="menu-item">${i.ideaName}</a>`)
      .join('');
  } catch (err) {
    console.error(err);
  }
}













let generateIdeasSideBar = async ()=>{
  try {

    let user = JSON.parse(localStorage.getItem('user'))
    let userId = user.data.user._id
    console.log(userId)


    let ideas = await axios.get(`/api/save/ideas/${userId}`)
    ideas = ideas.data.idea

    let HTML = generateHTML(ideas)
    document.querySelector('.js-menu').innerHTML = HTML

  } catch (error) {
    console.log(error)
  }
}


function generateHTML(ideas) {
  let HTML = ``
  ideas.forEach((idea)=>{
    console.log(idea.ideaName)
    HTML += `
      <a href="/scoreboard-page.html" class="menu-item active">${idea.ideaName}</a>
    `
  })
  return HTML;
}

generateIdeasSideBar()

/*
function updatelocalStorage() {
  
  localStorage.setItem('ideaId', )
}
*/