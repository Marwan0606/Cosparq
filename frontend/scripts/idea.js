function getUserInput() {
  document.querySelector('.js-analyze-button').addEventListener('click', async ()=>{
    try {
      let user = JSON.parse(localStorage.getItem('user'))
      console.log(user)
      let userId = user.data.user._id
      console.log(userId)

      /*
      let userResponse = await axios.post(`/api/users/${userId}`) //NOTE THIS IS WAY BETTER PRACTICE GETTING THE USER FROM THE BACKEND FOR SAFETY
      console.log(userResponse)
      */

      let newScoreGenerate = true;

      localStorage.setItem('newScoreGenerateValue', newScoreGenerate)

      let idea = document.querySelector('.js-input').value
      let ideaName = document.querySelector('.js-idea-name').value
      console.log(ideaName)
      let response = await axios.post('/api/save/idea', {idea, userId, ideaName})
      window.location.href = '/scoreboard-page.html';

      /*
      localStorage.clear()
      let userInput = document.querySelector('.js-input').value
      sessionStorage.setItem('idea', userInput);
      
      */ 
    } catch (error) {
      console.log(error)
    }

  })
}

getUserInput()

/*
function newScoreGenerate() {
  let newScoreGenerate = true
  return newScoreGenerate
}
*/