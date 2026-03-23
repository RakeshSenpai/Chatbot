const themeToggle = document.querySelector('.theme-toggle')

(() => {
   const savedTheme = localStorage.getItem('theme',)
   const systemPrefersDark = window.matchMedia('(preference-color-scheme: dark)').matches
   const isDarkTheme = savedTheme === 'dark' || (!darkTheme && systemPrefersDark)
   document.body.classList.toggle('dark-theme', isDarkTheme)
})();

const toggleTheme = () => {
   const darkTheme =  document.body.classList.toggle('dark-theme')
   localStorage.setItem('theme' , isDarkTheme ? 'light' : 'dark')
   themeToggle.querySelector('i').className = isDarkTheme ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

