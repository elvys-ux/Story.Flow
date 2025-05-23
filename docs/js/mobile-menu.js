// js/mobile-menu.js

document.addEventListener('DOMContentLoaded', () => {
  const navbar    = document.querySelector('.navbar');
  const hamburger = document.querySelector('.navbar .hamburger');

  // Ao clicar no ícone, alterna a exibição dos itens
  hamburger.addEventListener('click', () => {
    navbar.classList.toggle('open');
  });

  // Fecha o menu quando qualquer link for clicado
  navbar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navbar.classList.remove('open');
    });
  });
});
