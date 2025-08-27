// set-axios-defaults.js
const token = localStorage.getItem('accessToken');
if (!token) {
  window.location.href = 'auth.html';
} else {
  axios.defaults.baseURL = 'http://localhost:5004';
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

const loadEditPage = ()=>{
  const task = JSON.parse(localStorage.getItem('task'))
  console.log(task)

  document.querySelector('.js-title-input').value = task.title
  document.querySelector('.js-assignee').value = task.assignedToName
  if (task.description) {
    document.querySelector('.js-description').value = task.description
  }

  if (task.urgency) {
    console.log(task.urgency)
    document.getElementById(`u-${task.urgency}`).checked = true;
  }

  if (task.date) {
    console.log(task.date)
    document.querySelector('.js-date-input').value = task.date
  }

  document.querySelector('.js-completed').checked = task.completed
}

const update = async ()=>{
  const task = JSON.parse(localStorage.getItem('task'))
  console.log(task)
  
  let title = document.querySelector('.js-title-input').value

  let assignedToName = document.querySelector('.js-assignee').value

  let description = document.querySelector('.js-description').value

  const urgency = document.querySelector('input[name="urgency"]:checked')?.value

  let date = document.querySelector('.js-date-input').value

  let completed = document.querySelector('.js-completed').checked
  console.log(completed)

  try {
    let taskId = task._id
    let response = await axios.patch(`/api/v1/tasks/${taskId}`, {title, assignedToName, description, urgency, date, completed})
    console.log(response)
  } catch (error) {
    console.log(error)
  }
}



document.querySelector('.js-save-btn').addEventListener('click', async()=>{
  await update()
  window.location.href = '/tasks-page.html'
})



loadEditPage()

