let holdTimer = null;

document.addEventListener('DOMContentLoaded', () => {

    const volUp   = document.getElementById('volUpBtn');
    const volDown = document.getElementById('volDownBtn');

    const tmpUp   = document.getElementById('tempUpBtn');   
    const tmpDown = document.getElementById('tempDownBtn');

    const startHold = (fn, step) => {
        fn(step);                                             // immediate tick
        holdTimer = setInterval(() => fn(step), 250);
    };
    const stopHold  = () => clearInterval(holdTimer);

    volUp  .addEventListener('mousedown', () => startHold(changeVolume, +5));
    volDown.addEventListener('mousedown', () => startHold(changeVolume, -5));
    volUp  .addEventListener('mouseup', stopHold);
    volDown.addEventListener('mouseup', stopHold);
    volUp  .addEventListener('mouseleave', stopHold);
    volDown.addEventListener('mouseleave', stopHold);

    tmpUp  ?.addEventListener('mousedown', () => startHold(changeTempo, +30));
    tmpDown?.addEventListener('mousedown', () => startHold(changeTempo, -30));
    tmpUp  ?.addEventListener('mouseup', stopHold);
    tmpDown?.addEventListener('mouseup', stopHold);
    tmpUp  ?.addEventListener('mouseleave', stopHold);
    tmpDown?.addEventListener('mouseleave', stopHold);

    const touchWrap = (btn, fn, step) => {
        btn?.addEventListener('touchstart', e => {
            e.preventDefault();
            startHold(fn, step);
        });
        btn?.addEventListener('touchend', stopHold);
    };
    touchWrap(volUp,   changeVolume, +5);
    touchWrap(volDown, changeVolume, -5);
    touchWrap(tmpUp,   changeTempo,  +30);
    touchWrap(tmpDown, changeTempo,  -30);

    document.getElementById('playBtn')?.addEventListener('click', play);
    document.getElementById('stopBtn')?.addEventListener('click', stop);
});


function changeVolume(delta) {
    const cur = latestState.volume ?? 50;
    const next = Math.max(0, Math.min(100, cur + delta));
    sendAction('set_volume', next);
}

function changeTempo(delta) {
    const cur = latestState.tempo ?? 60;
    const next = Math.max(60, Math.min(120, cur + delta));
    sendAction('set_tempo', next);
}

function goBack() { 
  sendAction('set_page', 'home'); 
  window.location.href = '/';   
}

function play()        { sendAction('start'); }
function stop()        { sendAction('stop');  }
