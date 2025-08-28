axios.defaults.baseURL = 'http://localhost:5004';
axios.defaults.withCredentials = true;   // ← send & receive cookies




function getUserInput() {
  document.querySelector('.js-analyze-button').addEventListener('click', async ()=>{
    try {
      /*
      let user = JSON.parse(localStorage.getItem('user'))
      console.log(user)
      let userId = user.data.user._id
      console.log(userId)
      */
     

      let idea = document.querySelector('.js-input').value
      let ideaName = document.querySelector('.js-idea-name').value
      console.log(ideaName)
      let response = await axios.post('/api/save/idea', {idea, ideaName}) //saving the idea
      console.log(response)

      console.log(localStorage.setItem('ideaId', JSON.stringify(response.data.ideaRes._id)))
      
      window.location.href = '/scoreboard-page.html';

      /*
      localStorage.clear()
      let userInput = document.querySelector('.js-input').value
      sessionStorage.setItem('idea', userInput);
      
      */ 
    } catch (error) {
      if (error.response?.status === 403) {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('http://localhost:4004/token', {token: refreshToken})
        let newToken = response.data.accessToken;

        localStorage.setItem('accessToken', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

        console.log(`new access token: ${newToken}`)
        return location.reload();
      }
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