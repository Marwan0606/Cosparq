document.getElementById('postBtn').addEventListener('click', ()=>{
  console.log('click')
  document.getElementById('detailsPopover').hidden = false;
  
})

document.getElementById('cancelBtn').addEventListener('click', ()=>{
  console.log('click')
  document.getElementById('detailsPopover').hidden = true;
  
})
