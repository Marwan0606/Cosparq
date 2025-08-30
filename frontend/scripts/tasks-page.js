axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies




document.getElementById('postBtn').addEventListener('click', ()=>{
  console.log('click')
  document.getElementById('detailsPopover').hidden = false;
  
})

document.getElementById('cancelBtn').addEventListener('click', ()=>{
  console.log('click')
  document.getElementById('detailsPopover').hidden = true;
  
})

/*
let ideaId='';
let idea='';
let ideaText=''
let loadIdea = async ()=>{
  ideaId = JSON.parse(localStorage.getItem('ideaId'))
  idea = await axios.get(`/api/save/idea/${ideaId}`)
  ideaText = idea?.data?.idea?.idea;
}
*/

const addTask = async ()=>{
  try {
    let ideaId = JSON.parse(localStorage.getItem('ideaId'))
    let title = document.querySelector('.js-input-task').value
    let assignedToName = document.getElementById('assigneeInput').value
    let urgency = document.getElementById('urgencySelect').value
    let date = document.getElementById('dueInput').value
    let description = document.getElementById('description-text').value
    response = await axios.post('/api/v1/tasks', {title, description, assignedToName, urgency, date, ideaId})
  } catch (error) {
    console.log(error)
  }
}


const getAllTasks = async ()=>{
  try {
    let ideaId = JSON.parse(localStorage.getItem('ideaId'))
    let response = await axios.get(`/api/v1/tasks/team/${ideaId}`)
    //console.log(response)
    let tasks = response.data.tasks
    //console.log(tasks)
    generateTasksHTML(tasks)
  } catch (error) {
    console.log(error)
  }
}


const deleteTask = async (taskId)=>{
  try {
    
    let response = await axios.delete(`/api/v1/tasks/${taskId}`)
  } catch (error) {
    console.log(error)
  }
}

const updateTask = async (taskId, completed)=>{
  try {
    let response = await axios.patch(`/api/v1/tasks/${taskId}`, {completed})
    console.log(response)
  } catch (error) {
    console.log(error)
  }
}

const generateTasksHTML = (tasks)=>{

  tasks.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));

  const taskListEl = document.querySelector('.js-task-list');
  if (tasks.length === 0) {
    taskListEl.innerHTML = `
      <section id="emptyCard" class="card empty" aria-hidden="false">
        <h3>No tasks yet</h3>
        <p>Add your first task above to get started</p>
      </section>
    `;
    return; // nothing else to bind
  }


  let HTML='';
  tasks.forEach((task)=>{
    HTML += `
    <section id="listCard" class="card list js-task-card">
      <article class="tm-task" data-urgency="${task.urgency}">
        <label class="tm-check">
          <input class="js-checkBox" type="checkbox" aria-label="Mark task complete" data-product-id="${task._id}" ${task.completed ? `checked`: ''}>
          <span class="tm-check__box"></span>
        </label>

        <div class="tm-task__main">
          <h3 class="tm-task__title">${task.title}</h3>

          ${task.description ? `<p class="tm-task__desc">${task.description}</p>` : ''}

          ${task.urgency || task.assignedToName || task.date ? `<div class="tm-task__meta">

            ${task.urgency ? `<span class="tm-badge tm-badge--urgency" title="Urgency">${task.urgency}</span>` : ''}
            ${task.urgency ? `<span class="tm-dot">•</span>` : ''}

            ${task.assignedToName ? `<span class="tm-badge tm-badge--assignee" title="Assignee">@${task.assignedToName}</span>` : ''}
            ${task.assignedToName ? `<span class="tm-dot">•</span>` : ''}
            
            ${task.date ? `<span class="tm-badge tm-badge--due is-today" title="Deadline">${task.date}</span>` : ''}
            
          </div>` : ''}
        </div>

        <div class="tm-task__actions">
          <button class="js-edit-btn tm-icon-btn" title="Edit" data-product-id="${task._id}">✎</button>
          <button class="tm-icon-btn js-delete" data-product-id="${task._id}" title="Delete">✕</button>
        </div>
      </article>
    </section>
    `

  })

  if (HTML) {
    document.querySelector('.js-task-list').innerHTML = HTML
  }
  

  document.querySelectorAll('.js-delete').forEach((task)=>{
    task.addEventListener('click', async ()=>{
      const taskId = task.dataset.productId
      console.log(taskId)
      await deleteTask(taskId)
      await getAllTasks()
    })
  })

  document.querySelectorAll('.js-checkBox').forEach((task)=>{
    task.addEventListener('click', async ()=>{
      const completed = task.checked;
      const taskId = task.dataset.productId
      
      await updateTask(taskId, completed)
      await getAllTasks()
    })
  })

  document.querySelectorAll('.js-edit-btn').forEach((task)=>{
    task.addEventListener('click', async ()=>{
      const taskId = task.dataset.productId
      let response = await axios.get(`/api/v1/tasks/${taskId}`)
      let taskData = response.data.task
      console.log(`TaskData: ${taskData}`)
      localStorage.setItem('task', JSON.stringify(taskData));
      window.location.href = '/edit-page.html'
    })
  })
}

document.getElementById('submitTaskBtn').addEventListener('click', ()=>{
  addTask()
  getAllTasks()
})

getAllTasks()

//THIS IS FOR THE AUTO GENERATED AI TASKS

const tasksAI = async ()=>{

  let ideaId = JSON.parse(localStorage.getItem('ideaId'))
  let idea = await axios.get(`/api/save/idea/${ideaId}`)
  idea = idea.data.idea.idea

  let actionPage = await axios.get(`api/save/saveAction/${ideaId}`);
  actionPlan = JSON.stringify(actionPage.data.actionResponse.actionPlanResponse)


  let allTasks = await axios.get(`/api/v1/tasks/team/${ideaId}`)
  console.log(allTasks)
  const tasksLength = Object.keys(allTasks.data.tasks).length
  let specificTasks = []
  for (let i = 0; i < tasksLength; i++) {
    specificTasks.push(`Title of task ${i}: ${allTasks.data.tasks[i].title}`)
    if (allTasks.data.tasks[i].description) {
      specificTasks.push(`Description of task ${i}: ${allTasks.data.tasks[i].description}`)
    }
    if (allTasks.data.tasks[i].completed) {
      specificTasks.push(`The task number ${i} was marked as COMPLETED by the user`)
    }
  }
  console.log(specificTasks)
  specificTasks = JSON.stringify(specificTasks)
  




  let response = await axios.post('/api/responses/tasksAi', {idea, specificTasks, actionPlan})
  console.log('AI Response of Tasks', response)

  generateAiTasks(response)
}


//this is to map the response and generate the tasks
generateAiTasks = async (response)=>{
  let tasksAiRes = JSON.parse(response.data.result)
  console.log('response parsed', tasksAiRes)
  if (tasksAiRes.tasks) {
    tasksAiRes = tasksAiRes.tasks
  }
  console.log('final format', tasksAiRes)
  tasksAiRes.forEach(async (task)=>{
    let ideaId = JSON.parse(localStorage.getItem('ideaId'))
    response = await axios.post('/api/v1/tasks', {title: task.title, description: task.description, ideaId})
    getAllTasks()
  })
}



addLoading = ()=>{
  HTML = `
  <div class="frame">
    <div class="brand-wrap">
      <div class="brand">Your AI is Creating Your Daily Tasklist</div>
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
  </div>
  `
  document.querySelector('.js-task-list').innerHTML = HTML
}




document.getElementById('aiTaskBtn').addEventListener('click', ()=>{
  addLoading()
  tasksAI()
})







// loading.js

// Per-element cooldown tracking
const lastTime = new WeakMap();

// Tunables
const MAX_ACTIVE = 5;   // max simultaneous glows
const COOLDOWN  = 900;  // ms before same element can glow again

function canPulse(el){
  if (!el) return false;
  const now  = performance.now();
  const last = lastTime.get(el) || 0;
  // only pulse if enough time has passed and under the max concurrent
  return (now - last) > COOLDOWN && loading.active < MAX_ACTIVE;
}

function pulse(el, cls){
  if (!el || !canPulse(el)) return;
  loading.active++;
  lastTime.set(el, performance.now());

  el.classList.remove(cls);
  // force reflow to restart animation
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add(cls);

  el.addEventListener('animationend', () => {
    el.classList.remove(cls);
    loading.active--;
  }, { once: true });
}

function pick(list){
  for (let i = 0; i < 6; i++){
    const candidate = list[Math.floor(Math.random() * list.length)];
    if (canPulse(candidate)) return candidate;
  }
  return null;
}

// expose an “active” counter so canPulse can see it
const loading = { active: 0 };

(function loop(){
  // re-query nodes & links each iteration, after SVG has been injected
  const nodes = [...document.querySelectorAll('#nodes .node')].filter(n => n.id !== 'c');
  const links = [...document.querySelectorAll('#links .link')];

  pulse(pick(links), 'glow');
  pulse(pick(nodes), 'glow');
  if (Math.random() > 0.4) pulse(pick(nodes), 'glow');

  // schedule next glow
  setTimeout(loop, 300 + Math.random() * 680);
})();
