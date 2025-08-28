let user = ''
let userId = ''

const createUser = async ()=>{
  try {
    const name = document.querySelector('.js-signup-name').value
    const email = document.querySelector('.js-signup-email').value
    const password = document.querySelector('.js-signup-password').value
    
    try {
      let user = await axios.post('http://localhost:4004/register', {name, email, password})
    } catch (error) {
      let errorMessage = 'Email is already linked to an existing account'
      document.querySelector('.js-error-message').innerHTML = errorMessage
      return
    }
    

    /*
    console.log(user)
    //user = user.data.user
    user = user.data
    userId = user._id
    */

    //localStorage.setItem('user', JSON.stringify(user))

 
    window.location.href = 'auth.html';
    
  } catch (error) {
    console.log(error)

    if (error.response && error.response.status === 409) {
      let errorMessage = 'Email is already linked to an existing account'
      document.querySelector('.js-error-message').innerHTML = errorMessage
    } else {
      console.error('Unexpected error:', error);
    }

    /*
    if (error.user) {
      console.log('Status:', error.user.status)
      console.log('Response Data:', error.user.data)
    } else {
      console.log('Error Message:', error.message)
    }
    */
  }
}

const login = async ()=>{
  try {
    const email = document.querySelector('.js-login-email').value
    const password = document.querySelector('.js-login-password').value

    let user = await axios.post('http://localhost:4004/login', {email, password}, { withCredentials: true })

    console.log(user.msg)

    const { accessToken, refreshToken } = user.data;
    

    //localStorage.setItem('user', JSON.stringify(user.data))

    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    /*
    let localaccess = localStorage.getItem('accessToken')
    let localrefresh = localStorage.getItem('refreshToken')

    console.log(localaccess)
    console.log(localrefresh)
    */

    /*
    if (localStorage.getItem('user')) {
      window.location.href = 'idea-page.html';
    } else {
      console.error('Failed to store user in localStorage!');
    }
    */

    window.location.href = 'idea-page.html';
    
  } catch (error) {

    const problem = error.response.data.msg
    console.log(problem)
    document.querySelector('.js-problem').innerHTML = problem
  }
}

document.querySelector('#signup-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  createUser();
});

document.querySelector('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  login();
});