// Common utilities for Medaithon Food System: Audio, Socket, Toasts, Confetti, Helpers

// Initialize Audio Context on demand (handles browser auto-play policy)
let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 1. Success Sound: Uplifting 3-tone harmonic chime (C5 -> E5 -> G5)
function playSuccessChime() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.5);
    });
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

// 2. Duplicate Alert: Distinct double warning buzz (180 Hz saw/square)
function playDuplicateAlert() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.16].forEach((startTime) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now + startTime);

      gain.gain.setValueAtTime(0, now + startTime);
      gain.gain.linearRampToValueAtTime(0.3, now + startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startTime + 0.13);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + startTime);
      osc.stop(now + startTime + 0.14);
    });
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

// 3. Error Warning: Muffled error tone
function playErrorTone() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.25);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

// Trigger celebratory confetti
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#10b981', '#6366f1', '#06b6d4', '#f59e0b']
    });
  }
}

// Toast Notifications
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  } else {
    iconSvg = `<svg class="w-5 h-5 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="flex-1 text-sm font-medium leading-snug">${message}</div>
    <button onclick="this.parentElement.remove()" class="text-white/60 hover:text-white ml-2 text-xs font-bold">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Relative time formatting
function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

// Format readable local time
function formatClockTime(dateString) {
  if (!dateString) return '--:--';
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Generate Diet Badge HTML
function getDietBadge(dietPref) {
  const isVeg = (dietPref || '').toLowerCase() === 'veg';
  if (isVeg) {
    return `<span class="badge-veg">VEG</span>`;
  }
  return `<span class="badge-nonveg">NON-VEG</span>`;
}

// Animate numbers smoothly
function animateNumber(element, start, end, duration = 600) {
  if (!element) return;
  const startTime = performance.now();
  const startNum = parseInt(start, 10) || 0;
  const endNum = parseInt(end, 10) || 0;
  
  if (startNum === endNum) {
    element.textContent = endNum.toLocaleString();
    return;
  }

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quad
    const currentVal = Math.round(startNum + (endNum - startNum) * (1 - (1 - progress) * (1 - progress)));
    element.textContent = currentVal.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = endNum.toLocaleString();
    }
  }

  requestAnimationFrame(update);
}

// Helper to init Lucide icons if available
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Setup user sound preference toggle
window.addEventListener('DOMContentLoaded', () => {
  const savedSound = localStorage.getItem('medaithon_sound_enabled');
  if (savedSound !== null) {
    soundEnabled = savedSound === 'true';
  }
  
  // Re-enable audio context on first user click
  document.addEventListener('click', () => {
    getAudioContext();
  }, { once: true });
});
