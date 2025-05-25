
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

document.getElementById('jailbreak').addEventListener('click', () => {
    loadMultipleScripts(
        ["./payload.js", "./alert.mjs"],
        () => { console.log("All scripts are loaded !"); }
    );
});

const checkbox = document.getElementById('autogoldhen');

function onCheckboxChange(checked) {
  if (checked) {
    console.log('Checkbox is checked!');
  } else {
    console.log('Checkbox is unchecked!');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('autogoldhenstate');
  if (saved !== null) {
    checkbox.checked = saved === 'true';
    onCheckboxChange(checkbox.checked);
  }

  // Show alert if checkbox is checked on page load
  if (checkbox.checked) {
    if (confirm('The jailbreak is going to start please confirm !\nWARNING :\nThis option make the jailbreak unstable and this option is not recommended please use the jailbreak button instead !')) {
      loadMultipleScripts(
        ["./payload.js", "./alert.mjs"],
        () => { console.log("All scripts are loaded !"); }
      );
    }
    
  }
});

checkbox.addEventListener('change', (e) => {
  alert("WARNING :\nThis option make the jailbreak unstable and this option is not recommended please use the jailbreak button instead !")
  localStorage.setItem('autogoldhenstate', e.target.checked);
  onCheckboxChange(e.target.checked);
});
