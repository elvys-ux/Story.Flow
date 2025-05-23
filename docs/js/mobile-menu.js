// js/mobile-menu.js

document.addEventListener('DOMContentLoaded', () => {
  const navbar    = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger');

  if (!navbar || !hamburger) return;

  // abre/fecha o menu
  hamburger.addEventListener('click', () => {
    navbar.classList.toggle('open');
  });

  // fecha o menu ao clicar em qualquer item
  navbar.querySelectorAll('.navbar-menu a').forEach(link => {
    link.addEventListener('click', () => {
      navbar.classList.remove('open');
    });
  });
});
