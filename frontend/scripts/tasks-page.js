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




/*
document.addEventListener('DOMContentLoaded', () => {
  const keyBox    = document.getElementById('secret-key-box');
  const keyText   = document.getElementById('secret-key-text');
  const toggleBtn = document.getElementById('secret-key-btn');

  // Load the actual key from localStorage (or any other source)
  const secretKey = localStorage.getItem('key') || 'unknown-key';

  let visible = false;

  toggleBtn.addEventListener('click', () => {
    visible = !visible;
    if (visible) {
      // show the real key
      keyText.textContent = teamId;
      toggleBtn.textContent = 'Hide';
      toggleBtn.setAttribute('aria-label', 'Hide secret key');
    } else {
      // mask it
      keyText.textContent = '•••••••••••••••••••';
      toggleBtn.textContent = 'Show';
      toggleBtn.setAttribute('aria-label', 'Show secret key');
    }
  });
});
*/





getAllTasks()