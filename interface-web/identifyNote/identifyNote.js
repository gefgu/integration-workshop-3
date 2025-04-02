let holdTimer = null;

document.addEventListener('DOMContentLoaded', () => {

    const volUp   = document.getElementById('volUpBtn');
    const volDown = document.getElementById('volDownBtn');

    const startHold = step => {
        changeVolume(step);                   // immediate tick
        holdTimer = setInterval(() => changeVolume(step), 250);
    };
    const stopHold  = () => clearInterval(holdTimer);

    volUp  .addEventListener('mousedown', () => startHold(+5));
    volUp  .addEventListener('mouseup',   stopHold);
    volUp  .addEventListener('mouseleave',stopHold);

    volDown.addEventListener('mousedown', () => startHold(-5));
    volDown.addEventListener('mouseup',   stopHold);
    volDown.addEventListener('mouseleave',stopHold);

    volUp  .addEventListener('touchstart', e => { e.preventDefault(); startHold(+5); });
    volUp  .addEventListener('touchend',   stopHold);

    volDown.addEventListener('touchstart', e => { e.preventDefault(); startHold(-5); });
    volDown.addEventListener('touchend',   stopHold);

    document.getElementById('musicSelect')
            .addEventListener('change', selectMusic);

    document.getElementById('playBtn')?.addEventListener('click', play);
    document.getElementById('stopBtn')?.addEventListener('click', stop);
});

function changeVolume(delta) {
    const current = latestState.volume ?? 50;
    const newVol  = Math.max(0, Math.min(100, current + delta));
    sendAction('set_volume', newVol);
}

function play()            { sendAction('start'); }
function stop()            { sendAction('stop');  }

function selectMusic() {
    const melody = document.getElementById('musicSelect').value;
    sendAction('select_melody', melody);
}

function goBack() { 
  sendAction('set_page', 'home'); 
  window.location.href = '/';   
}