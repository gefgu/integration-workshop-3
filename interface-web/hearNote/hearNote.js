let holdTimer = null;

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('playNoteBtn')
          .addEventListener('click', playNote);

  const volUpBtn   = document.getElementById('volUpBtn');
  const volDownBtn = document.getElementById('volDownBtn');

  function startHold(step) {
      changeVolume(step);                       
      holdTimer = setInterval(() => changeVolume(step), 250);
  }
  function stopHold() { clearInterval(holdTimer); }

  volUpBtn  .addEventListener('mousedown', () => startHold(+5));
  volUpBtn  .addEventListener('mouseup',   stopHold);
  volUpBtn  .addEventListener('mouseleave', stopHold);

  volDownBtn.addEventListener('mousedown', () => startHold(-5));
  volDownBtn.addEventListener('mouseup',   stopHold);
  volDownBtn.addEventListener('mouseleave', stopHold);

  volUpBtn  .addEventListener('touchstart', e => { e.preventDefault(); startHold(+5); });
  volUpBtn  .addEventListener('touchend',   stopHold);

  volDownBtn.addEventListener('touchstart', e => { e.preventDefault(); startHold(-5); });
  volDownBtn.addEventListener('touchend',   stopHold);
});



function changeVolume(delta) {
  const current = (latestState.volume ?? 50);
  const newVol  = Math.max(0, Math.min(100, current + delta));
  sendAction('set_volume', newVol);
}

function play() {  sendAction('start'); }
function stop() {  sendAction('stop');  }

function selectMusic() {
  const melody = document.getElementById('musicSelect').value;
  sendAction('select_melody', melody);
}

function goBack() { 
  sendAction('set_page', 'home'); 
  window.location.href = '/';   
}

function playNote() {
  console.log('Sending action to play current note');
  sendAction('play_current_note'); 
}