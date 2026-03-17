const themeToggle = document.querySelector('.theme-toggle')

const toggleTheme = () => {
   const darkTheme =  document.body.classList.toggle('dark-theme')
   themeToggle.querySelector('i').className = isDarkTheme ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}
