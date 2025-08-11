generateIdeasSideBar = async ()=>{
  try {
    ideas = await axios.get('/')
  } catch (error) {
    
  }
}