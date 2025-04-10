  function exibirUsuarioLogado(){
      const userArea = document.getElementById('userMenuArea');
      userArea.innerHTML = '';
      const userData = JSON.parse(localStorage.getItem('loggedUser'));
  
      if(userData && userData.username){
        userArea.innerHTML = userData.username;
        userArea.onclick = function(){
          if(confirm("Deseja fazer logout?")){
            localStorage.removeItem('loggedUser');
            location.reload();
          }
        };
      } else {
        userArea.innerHTML = `
          <a href="Criacao.html" style="color:white;">
            <i class="fas fa-user"></i> Login
          </a>`;
        userArea.onclick = null;
      }
    }
    document.addEventListener('DOMContentLoaded', exibirUsuarioLogado);