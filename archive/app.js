// The Junkins Archive — app logic
//
// Security: video links are NOT in this file or the HTML. They are decrypted in
// the browser from data.enc only after the correct password is entered (see
// crypto.js). A wrong password fails the AES-GCM auth check, so there is no
// plaintext to leak. The decrypted list lives only in memory; a refresh
// re-prompts.

let archiveData = null;
let encryptedBlobPromise = null;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- encrypted blob ----
function loadEncryptedBlob() {
    if (!encryptedBlobPromise) {
        encryptedBlobPromise = fetch('data.enc', { cache: 'no-store' }).then(res => {
            if (!res.ok) throw new Error('Could not load archive data (' + res.status + ').');
            return res.text();
        });
    }
    return encryptedBlobPromise;
}

// ---- boot ----
document.addEventListener('DOMContentLoaded', () => {
    startTapeCounter();
    if (!reduceMotion) scheduleGlitch();
    wireLock();
    wirePlayer();
});

// ---- lock screen ----
function wireLock() {
    const form = document.getElementById('lock-form');
    const input = document.getElementById('code-input');
    if (form) form.addEventListener('submit', handleUnlock);
    if (input) input.focus();
}

async function handleUnlock(e) {
    e.preventDefault();
    const input = document.getElementById('code-input');
    const errorEl = document.getElementById('lock-error');
    const btn = document.querySelector('.lock__btn');
    const code = input.value;

    if (errorEl) errorEl.textContent = '';
    if (btn) { btn.disabled = true; btn.textContent = 'TRACKING…'; }

    try {
        const blob = await loadEncryptedBlob();
        const plaintext = await ArchiveCrypto.decrypt(blob, code); // throws on wrong code
        archiveData = JSON.parse(plaintext);
        revealArchive();
    } catch (err) {
        const isLoadError = err && /load archive data/i.test(err.message || '');
        if (errorEl) errorEl.textContent = isLoadError ? err.message : '✖ WRONG CODE — NO SIGNAL';
        if (!isLoadError && input) { input.value = ''; input.focus(); }
        const lock = document.getElementById('lock-screen');
        if (lock && !reduceMotion) {
            lock.classList.add('bad');
            setTimeout(() => lock.classList.remove('bad'), 420);
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = 'PLAY&nbsp;&#9654;'; }
    }
}

function revealArchive() {
    const lock = document.getElementById('lock-screen');
    const content = document.getElementById('archive-content');
    if (lock) {
        lock.classList.add('hidden');
        setTimeout(() => { lock.style.display = 'none'; }, 360);
    }
    if (content) {
        content.hidden = false;
        renderArchive();
    }
}

// ---- render ----
function renderArchive() {
    const tapes = document.getElementById('tapes');
    if (!tapes || !archiveData) return;
    tapes.innerHTML = '';

    if (!Array.isArray(archiveData.folders) || archiveData.folders.length === 0) {
        tapes.innerHTML = '<p class="archive__intro">No tapes found.</p>';
        return;
    }

    archiveData.folders.forEach((folder, i) => {
        tapes.appendChild(buildTape(folder, i + 1));
    });
}

function buildTape(folder, number) {
    const section = document.createElement('section');
    section.className = 'tape';

    const label = document.createElement('div');
    label.className = 'tape__label';
    const no = document.createElement('div');
    no.className = 'tape__no';
    no.textContent = 'TAPE ' + String(number).padStart(2, '0');
    const name = document.createElement('div');
    name.className = 'tape__name';
    name.textContent = folder.name || 'Untitled';
    label.appendChild(no);
    label.appendChild(name);
    section.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'clips';
    const era = eraFromName(folder.name || '');
    (folder.items || []).forEach(item => grid.appendChild(buildClip(item, era)));
    section.appendChild(grid);

    return section;
}

function buildClip(item, era) {
    const clip = document.createElement('div');
    clip.className = 'clip';

    const isYouTube = item.url && (item.url.includes('youtube.com') || item.url.includes('youtu.be'));
    const ytId = isYouTube ? extractYouTubeId(item.url) : null;

    const thumb = document.createElement('div');
    thumb.className = 'clip__thumb';

    if (ytId) {
        thumb.style.backgroundImage = `url(https://img.youtube.com/vi/${ytId}/hqdefault.jpg)`;
    } else if (item.type === 'image' && item.url) {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.name || '';
        img.loading = 'lazy';
        thumb.appendChild(img);
    }

    const play = document.createElement('div');
    play.className = 'clip__play';
    play.innerHTML = '&#9654;';
    thumb.appendChild(play);

    const time = document.createElement('div');
    time.className = 'clip__time';
    time.textContent = era;
    thumb.appendChild(time);

    const rec = document.createElement('div');
    rec.className = 'clip__rec';
    rec.innerHTML = '<i></i>' + (item.type === 'image' ? 'PHOTO' : 'REC');
    thumb.appendChild(rec);

    clip.appendChild(thumb);

    const caption = document.createElement('div');
    caption.className = 'clip__name';
    caption.textContent = item.name || '';
    clip.appendChild(caption);

    clip.addEventListener('click', () => openPlayer(item, ytId));
    return clip;
}

// Pull a 4-digit year out of a folder name for the OSD timestamp, else "REC".
function eraFromName(name) {
    const m = String(name).match(/\b(19|20)\d{2}\b/);
    return m ? m[0] : 'REC';
}

function extractYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return (m && m[2].length === 11) ? m[2] : null;
}

// ---- CRT player ----
let playerTimer = null;

function wirePlayer() {
    document.querySelectorAll('#player [data-close]').forEach(el => {
        el.addEventListener('click', closePlayer);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlayer();
    });
}

function openPlayer(item, ytId) {
    const modal = document.getElementById('player');
    const media = document.getElementById('player-media');
    const title = document.getElementById('player-title');
    const ytLink = document.getElementById('player-yt');
    if (!modal || !media) return;

    media.innerHTML = '';

    if (ytId) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        media.appendChild(iframe);
    } else if (item.type === 'image' && item.url) {
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.name || '';
        media.appendChild(img);
    } else {
        const msg = document.createElement('div');
        msg.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#9b988e;font-family:var(--mono);font-size:1.4rem;';
        msg.textContent = '▶ NO SIGNAL';
        media.appendChild(msg);
    }

    if (title) title.textContent = item.name || '';
    if (ytLink) {
        if (item.url) {
            ytLink.href = item.url;
            ytLink.hidden = false;
            ytLink.innerHTML = (ytId ? '&#8599;&nbsp;YT' : '&#8599;&nbsp;OPEN');
        } else {
            ytLink.hidden = true;
        }
    }

    modal.hidden = false;
    startPlayerTimecode();
}

function closePlayer() {
    const modal = document.getElementById('player');
    const media = document.getElementById('player-media');
    if (!modal || modal.hidden) return;
    if (media) media.innerHTML = ''; // stops playback by removing the iframe
    modal.hidden = true;
    stopPlayerTimecode();
}

function startPlayerTimecode() {
    const el = document.getElementById('player-time');
    if (!el) return;
    let secs = 0;
    el.textContent = '0:00:00';
    stopPlayerTimecode();
    playerTimer = setInterval(() => { secs++; el.textContent = hms(secs); }, 1000);
}
function stopPlayerTimecode() {
    if (playerTimer) { clearInterval(playerTimer); playerTimer = null; }
}

// ---- OSD tape counter (cosmetic) ----
function startTapeCounter() {
    const el = document.getElementById('osd-clock');
    if (!el) return;
    const start = Date.now();
    const tick = () => { el.textContent = 'SP  ' + hms(Math.floor((Date.now() - start) / 1000)); };
    tick();
    setInterval(tick, 1000);
}

function hms(total) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// ---- occasional tracking glitch ----
function scheduleGlitch() {
    const next = 16000 + Math.random() * 18000; // 16–34s
    setTimeout(() => {
        document.body.classList.add('glitching');
        setTimeout(() => document.body.classList.remove('glitching'), 340);
        scheduleGlitch();
    }, next);
}
