if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => {
    console.log("[Service Worker] registered!")
  })
}


window.addEventListener('beforeinstallprompt', () => {

})