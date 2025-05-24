
function loadMultipleScripts(files, callback) {
  let loaded = 0;
  files.forEach(src => {
    // Vérifier si le script est déjà dans la page (éviter les doublons)
    if(document.querySelector('script[src="' + src + '"]')) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loaded++;
      if(loaded === files.length && typeof callback === "function") callback();
    };
    script.onerror = () => {
      loaded++;
      console.error("Erreur de chargement:", src);
      if(loaded === files.length && typeof callback === "function") callback();
    };
    document.body.appendChild(script);
  });
}


function showlinuxpayloads() {
document.getElementById('jailbreak').addEventListener('click', () => {
    loadMultipleScripts(
        ["./payloads/payload.js", "./psfree/alert.mjs"],
        () => { console.log("All scripts are loaded !"); }
    );
});





  // Show alert if checkbox is checked on page load
  if (checkbox.checked) {
    if (confirm('The jailbreak is going to start please confirm !\nWARNING :\nThis option make the jailbreak unstable and this option is not recommended please use the jailbreak button instead !')) {
      loadMultipleScripts(
        ["./payloads/payload.js", "./psfree/alert.mjs"],
        () => { console.log("All scripts are loaded !"); }
      );
    }
    
  }
});

