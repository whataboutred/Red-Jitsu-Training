useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // check for updates now and every 5 minutes
      reg.update();
      const id = setInterval(() => reg.update(), 5 * 60 * 1000);
      // reload when the new SW activates
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'SW_UPDATED') {
          window.location.reload();
        }
      });
      return () => clearInterval(id);
    }).catch(() => {});
  }
}, []);
