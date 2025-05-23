// js/mobile-menu.js

document.addEventListener('DOMContentLoaded', () => {
  const navbar    = document.querySelector('.navbar');
  const hamburger = navbar.querySelector('.hamburger');

  if (!hamburger) return;

  // Abre ou fecha o menu ao clicar no ícone
  hamburger.addEventListener('click', () => {
    navbar.classList.toggle('open');
  });

  // Fecha o menu quando qualquer item de link for clicado
  navbar.querySelectorAll('> a, > .dropdown > a, > #searchForm button').forEach(el => {
    el.addEventListener('click', () => {
      navbar.classList.remove('open');
    });
  });
});
