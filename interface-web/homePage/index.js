document.addEventListener("DOMContentLoaded", () => {
  const accSwitch = document.getElementById("accessibilityToggle");
  if (!accSwitch) return;

  accSwitch.addEventListener("change", () => {
    sendAction("set_accessibility", accSwitch.checked);
  });

  document.addEventListener("state-updated", (ev) => {
    const { accessibility } = ev.detail;
    if (typeof accessibility === "boolean") {
      accSwitch.checked = accessibility;
    }
  });
});
function navigateTo(page) {
  sendAction('set_page', page);     // NOT WORKING
  window.location.href = pageUrl(page);
}

// server-side routes: /creation, /hear, /identify
function pageUrl(name) {
  switch (name) {
    case 'creation': return '/creation';
    case 'hear':     return '/hear';
    case 'identify': return '/identify';
    default:         return '/';
  }
}

function showTutorial() {
  document.getElementById('tutorialOverlay').classList.add('show-tutorial');
}

function hideTutorial() {
  document.getElementById('tutorialOverlay').classList.remove('show-tutorial');
}