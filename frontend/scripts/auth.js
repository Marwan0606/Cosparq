let user = ''
let userId = ''

const createUser = async ()=>{
  try {
    const name = document.querySelector('.js-signup-name').value
    const email = document.querySelector('.js-signup-email').value
    const password = document.querySelector('.js-signup-password').value
    let user = await axios.post('http://localhost:5004/api/users/register', {name, email, password})


    console.log(user)
    user = user.data.user
    userId = user._id

    localStorage.setItem('user', JSON.stringify(user))

    if (localStorage.getItem('user')) {
      window.location.href = 'auth.html';
    } else {
      console.error('Failed to store user in localStorage!');
    }
    
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

    let user = await axios.post('http://localhost:5004/api/users/login', {email, password})

    console.log(user)
    //user = data.user
    userId = user._id

    localStorage.setItem('user', JSON.stringify(user))

    if (localStorage.getItem('user')) {
      window.location.href = 'idea-page.html';
    } else {
      console.error('Failed to store user in localStorage!');
    }
    
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