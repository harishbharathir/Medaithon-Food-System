// Volunteer Scanner Terminal Logic (Dual Counter Sync + Camera + Barcode Scanner)

let socket = null;
let html5QrCode = null;
let isCameraRunning = false;
let lastScannedCode = null;
let lastScanTimestamp = 0;
const SCAN_COOLDOWN_MS = 2500; // Cooldown to avoid accidental duplicate trigger on same code

let myCounterScans = [];
let currentStats = null;

// DOM Elements
const selectCounter = document.getElementById('selectCounter');
const inputVolunteerName = document.getElementById('inputVolunteerName');
const counterServedCount = document.getElementById('counterServedCount');
const selectMealSession = document.getElementById('selectMealSession');
const sessionStatusText = document.getElementById('sessionStatusText');
const activeMealName = document.getElementById('activeMealName');
const sessionTiming = document.getElementById('sessionTiming');
const statTotalTarget = document.getElementById('statTotalTarget');
const statClaimedTotal = document.getElementById('statClaimedTotal');
const statRemainingTotal = document.getElementById('statRemainingTotal');
const statPercentBadge = document.getElementById('statPercentBadge');
const statProgressBar = document.getElementById('statProgressBar');
const socketStatus = document.getElementById('socketStatus');

let allMealSessions = [];

const barcodeInput = document.getElementById('barcodeInput');
const btnClaimMeal = document.getElementById('btnClaimMeal');
const btnToggleCamera = document.getElementById('btnToggleCamera');
const cameraBtnText = document.getElementById('cameraBtnText');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const scanLaserLine = document.getElementById('scanLaserLine');

const stateIdle = document.getElementById('stateIdle');
const stateSuccess = document.getElementById('stateSuccess');
const stateDuplicate = document.getElementById('stateDuplicate');
const stateNotFound = document.getElementById('stateNotFound');

const modalWalkin = document.getElementById('modalWalkin');
const formWalkin = document.getElementById('formWalkin');
const walkinId = document.getElementById('walkinId');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  // Load saved preferences
  const savedCounter = localStorage.getItem('medaithon_counter_id');
  if (savedCounter) selectCounter.value = savedCounter;

  const savedVolunteer = localStorage.getItem('medaithon_volunteer_name');
  if (savedVolunteer) inputVolunteerName.value = savedVolunteer;

  selectCounter.addEventListener('change', () => {
    localStorage.setItem('medaithon_counter_id', selectCounter.value);
    updateCounterServeCount();
    if (socket && socket.connected) {
      socket.emit('register_counter', {
        counterId: selectCounter.value,
        volunteerName: inputVolunteerName.value
      });
    }
  });

  inputVolunteerName.addEventListener('change', () => {
    localStorage.setItem('medaithon_volunteer_name', inputVolunteerName.value);
  });

  // Meal Type Selection Event
  if (selectMealSession) {
    selectMealSession.addEventListener('change', handleMealSessionChange);
  }

  // Setup Sound Toggle Button
  const btnSoundToggle = document.getElementById('btnSoundToggle');
  const iconSound = document.getElementById('iconSound');
  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      localStorage.setItem('medaithon_sound_enabled', soundEnabled);
      showToast(soundEnabled ? 'Sound alerts enabled 🔔' : 'Sound muted 🔕', 'info');
      iconSound.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
      refreshIcons();
    });
  }

  // Barcode Input Events (Handheld Gun / Manual)
  barcodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSubmit();
    }
  });

  btnClaimMeal.addEventListener('click', handleBarcodeSubmit);

  // Camera Toggle
  btnToggleCamera.addEventListener('click', toggleCamera);

  // Walkin modal buttons
  document.getElementById('btnOpenManualEntry').addEventListener('click', () => {
    openWalkinModal(barcodeInput.value.trim());
  });

  formWalkin.addEventListener('submit', handleWalkinSubmit);

  // Setup Real-time WebSockets
  initSocket();

  // Initial stats and meal sessions fetch
  fetchStats();
  loadMealSessions();

  // Focus barcode input
  setTimeout(() => barcodeInput.focus(), 300);

  refreshIcons();
});

// Load Meal Sessions Added from Admin Page
async function loadMealSessions(preselectedId = null) {
  try {
    const res = await fetch('/api/sessions');
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      allMealSessions = json.data;
      renderMealSessions(allMealSessions, preselectedId || currentStats?.session?.id);
    }
  } catch (err) {
    console.error('Failed to load meal sessions:', err);
  }
}

// Render dynamic dropdown for Meal Types
function renderMealSessions(sessions, activeId = null) {
  if (!selectMealSession) return;
  allMealSessions = sessions || [];

  if (allMealSessions.length === 0) {
    selectMealSession.innerHTML = '<option value="">No meal sessions created in Admin</option>';
    return;
  }

  const active = allMealSessions.find(s => activeId ? s.id === parseInt(activeId) : s.is_active === 1) || allMealSessions[0];
  const targetId = active ? active.id : allMealSessions[0].id;

  selectMealSession.innerHTML = allMealSessions.map(s => {
    const timeStr = (s.start_time || s.end_time) ? ` (${s.start_time || '--:--'} - ${s.end_time || '--:--'})` : '';
    const isSelected = s.id === targetId ? 'selected' : '';
    const activeStar = s.is_active ? ' ⭐' : '';
    return `<option value="${s.id}" ${isSelected}>${s.name}${timeStr}${activeStar}</option>`;
  }).join('');

  if (active) {
    if (sessionTiming) sessionTiming.textContent = `${active.start_time || '--:--'} - ${active.end_time || '--:--'}`;
    if (statTotalTarget) statTotalTarget.textContent = (active.total_target || 0).toLocaleString();
    if (sessionStatusText) {
      sessionStatusText.textContent = active.is_active ? 'ACTIVE' : 'READY';
      sessionStatusText.className = active.is_active ? 'text-emerald-300' : 'text-amber-300';
    }
  }
}

// Handle volunteer switching meal type
async function handleMealSessionChange() {
  const selectedId = parseInt(selectMealSession.value);
  if (!selectedId) return;

  const target = allMealSessions.find(s => s.id === selectedId);
  if (!target) return;

  try {
    // Activate this session across the entire system so projector & all counters sync
    const res = await fetch(`/api/sessions/${selectedId}/activate`, { method: 'POST' });
    const json = await res.json();
    if (res.ok && json.success) {
      showToast(`Switched active meal to: <strong>${target.name}</strong>`, 'success');
      if (json.stats) updateUIWithStats(json.stats);
    } else {
      showToast('Could not activate meal session', 'error');
    }
  } catch (err) {
    console.error('Error switching meal session:', err);
  }
}

// Real-time WebSocket Initialization
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('[Socket] Connected to server:', socket.id);
    socketStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>Online</span>`;
    socketStatus.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

    socket.emit('register_counter', {
      counterId: selectCounter.value,
      volunteerName: inputVolunteerName.value
    });
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    socketStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span><span>Offline</span>`;
    socketStatus.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20';
  });

  // Listen for initial stats & sessions
  socket.on('initial_stats', (data) => {
    if (data && data.sessions) renderMealSessions(data.sessions, data.stats?.session?.id);
    else loadMealSessions();
    if (data && data.stats) updateUIWithStats(data.stats);
  });

  // Listen for real-time stats updates (from any counter or admin)
  socket.on('stats_update', (data) => {
    if (data && data.sessions) renderMealSessions(data.sessions, data.stats?.session?.id);
    if (data && data.stats) updateUIWithStats(data.stats);
  });

  // Real-time Meal Claimed Event: This triggers simultaneously on ALL counters!
  socket.on('meal_claimed', (data) => {
    const { claim, stats, sessions } = data;
    if (sessions) renderMealSessions(sessions, stats?.session?.id);
    if (stats) updateUIWithStats(stats);

    // If another counter claimed a meal, notify the volunteer
    if (claim && claim.counter_id !== selectCounter.value) {
      showToast(`⚡ <strong>${claim.counter_id}</strong> just served <strong>${claim.participant_name}</strong>`, 'info', 2500);
    }
  });

  // Session updated by Admin: Reflect immediately!
  socket.on('session_updated', (data) => {
    if (data && data.sessions) {
      renderMealSessions(data.sessions, data.session?.id || data.activeSession?.id);
    } else {
      loadMealSessions(data.session?.id || data.activeSession?.id);
    }
    if (data && data.stats) updateUIWithStats(data.stats);
    showToast(`Meal updated from Admin: <strong>${data.session ? data.session.name : (data.activeSession ? data.activeSession.name : 'Active Meal')}</strong>`, 'info');
  });
}

// Fetch Stats via REST API
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success && json.data) {
      updateUIWithStats(json.data);
    }
  } catch (err) {
    console.error('Failed to fetch stats:', err);
  }
}

// Update UI with latest real-time stats
function updateUIWithStats(stats) {
  currentStats = stats;
  const session = stats.session;

  if (session) {
    if (activeMealName) activeMealName.textContent = session.name;
    sessionTiming.textContent = `${session.start_time || '--:--'} - ${session.end_time || '--:--'}`;
    statTotalTarget.textContent = stats.total_target.toLocaleString();

    // Sync dropdown if different
    if (selectMealSession && selectMealSession.value !== String(session.id)) {
      selectMealSession.value = String(session.id);
    }
    if (sessionStatusText) {
      sessionStatusText.textContent = session.is_active ? 'ACTIVE' : 'SWITCHED';
      sessionStatusText.className = session.is_active ? 'text-emerald-300' : 'text-amber-300';
    }
  } else {
    if (activeMealName) activeMealName.textContent = 'No Active Session';
    sessionTiming.textContent = '--:--';
    statTotalTarget.textContent = '0';
    if (sessionStatusText) {
      sessionStatusText.textContent = 'NO ACTIVE SESSION';
      sessionStatusText.className = 'text-slate-400';
    }
  }
  }

  // Animate numbers for claimed & remaining
  const prevClaimed = parseInt(statClaimedTotal.textContent.replace(/,/g, '')) || 0;
  const prevRemaining = parseInt(statRemainingTotal.textContent.replace(/,/g, '')) || 0;

  animateNumber(statClaimedTotal, prevClaimed, stats.claimed_count || 0);
  animateNumber(statRemainingTotal, prevRemaining, stats.remaining_count || 0);

  // Progress Bar & Percentage
  const pct = stats.total_target > 0 ? Math.min(100, Math.round(((stats.claimed_count || 0) / stats.total_target) * 100)) : 0;
  statPercentBadge.textContent = `${pct}%`;
  statProgressBar.style.width = `${pct}%`;

  updateCounterServeCount();
}

function updateCounterServeCount() {
  if (!currentStats || !currentStats.counters) return;
  const count = currentStats.counters[selectCounter.value] || 0;
  counterServedCount.textContent = `${count} claimed here`;
}

// Handle Barcode Claim Request
async function handleBarcodeSubmit() {
  const code = barcodeInput.value.trim();
  if (!code) {
    showToast('Please enter or scan a barcode/ID', 'info');
    barcodeInput.focus();
    return;
  }

  processScan(code);
}

// Core scan verification and claim processing
async function processScan(barcode) {
  const cleanCode = barcode.trim();
  if (!cleanCode) return;

  // Debounce duplicate immediate physical scans
  const now = Date.now();
  if (cleanCode === lastScannedCode && (now - lastScanTimestamp) < SCAN_COOLDOWN_MS) {
    console.log('[Debounce] Ignored rapid repeated scan of', cleanCode);
    return;
  }

  lastScannedCode = cleanCode;
  lastScanTimestamp = now;

  try {
    const res = await fetch('/api/scans/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: cleanCode,
        counterId: selectCounter.value,
        volunteerName: inputVolunteerName.value,
        sessionId: selectMealSession && selectMealSession.value ? parseInt(selectMealSession.value) : undefined
      })
    });

    const data = await res.json();

    if (res.status === 200 && data.success) {
      // 1. SUCCESS: MEAL CLAIMED
      handleSuccess(data.claim, data.stats);
    } else if (res.status === 409 || data.code === 'ALREADY_CLAIMED') {
      // 2. DUPLICATE: ALREADY CLAIMED
      handleDuplicate(data.claim, data.participant);
    } else if (res.status === 404 || data.code === 'NOT_FOUND') {
      // 3. NOT FOUND IN DATABASE
      handleNotFound(cleanCode, data.message);
    } else {
      // Other error
      showToast(data.message || 'Error scanning ID', 'error');
      playErrorTone();
    }
  } catch (err) {
    console.error('Scan claim error:', err);
    showToast('Server connection error. Please retry.', 'error');
    playErrorTone();
  } finally {
    // Clear barcode input and re-focus for the next participant
    barcodeInput.value = '';
    barcodeInput.focus();
  }
}

// Render Success State
function handleSuccess(claim, stats) {
  playSuccessChime();
  triggerConfetti();

  // Hide other states
  stateIdle.classList.add('hidden');
  stateDuplicate.classList.add('hidden');
  stateNotFound.classList.add('hidden');
  stateSuccess.classList.remove('hidden');

  // Fill in participant details
  document.getElementById('resParticipantName').textContent = claim.participant_name;
  document.getElementById('resParticipantId').textContent = claim.participant_id;
  document.getElementById('resTeamName').textContent = claim.team_name || 'Independent';
  document.getElementById('resCollege').textContent = claim.college || 'Medaithon';
  document.getElementById('resMealName').textContent = claim.meal_name;
  document.getElementById('resCounterTime').textContent = `${claim.counter_id} • ${formatClockTime(claim.claimed_at)}`;

  // Diet badge
  document.getElementById('resDietBadge').innerHTML = getDietBadge(claim.diet_pref);

  // Add to local counter log
  addToMyCounterLog(claim, true);

  showToast(`✅ Meal claimed for <strong>${claim.participant_name}</strong>!`, 'success');

  refreshIcons();
}

// Render Duplicate State
function handleDuplicate(claim, participant) {
  playDuplicateAlert();

  stateIdle.classList.add('hidden');
  stateSuccess.classList.add('hidden');
  stateNotFound.classList.add('hidden');
  stateDuplicate.classList.remove('hidden');

  const pName = claim ? claim.participant_name : (participant ? participant.name : 'Participant');
  const pId = claim ? claim.participant_id : (participant ? participant.id : lastScannedCode);
  const diet = claim ? claim.diet_pref : (participant ? participant.diet_pref : 'Veg');

  document.getElementById('dupParticipantName').textContent = pName;
  document.getElementById('dupParticipantId').textContent = pId;
  document.getElementById('dupDietBadge').innerHTML = getDietBadge(diet);

  if (claim) {
    document.getElementById('dupDetails').innerHTML = `
      Meal was already collected for <strong>${claim.session_name || 'Active Session'}</strong>!
    `;
    document.getElementById('dupTimestamp').innerHTML = `
      <span>Claimed at: ${formatClockTime(claim.claimed_at)} (${formatTimeAgo(claim.claimed_at)})</span>
      <span class="font-bold text-rose-300">${claim.counter_id}</span>
    `;
  }

  showToast(`⚠️ Already claimed by ${pName}!`, 'error');

  refreshIcons();
}

// Render Not Found State
function handleNotFound(code, message) {
  playErrorTone();

  stateIdle.classList.add('hidden');
  stateSuccess.classList.add('hidden');
  stateDuplicate.classList.add('hidden');
  stateNotFound.classList.remove('hidden');

  document.getElementById('notFoundMessage').textContent = `Barcode / ID "${code}" is not registered in the database.`;
  showToast(`Participant ID "${code}" not found!`, 'error');

  refreshIcons();
}

// Add item to local counter log
function addToMyCounterLog(claim, isSuccess) {
  myCounterScans.unshift(claim);
  const container = document.getElementById('myCounterLog');
  const countBadge = document.getElementById('myCounterLogCount');

  countBadge.textContent = `${myCounterScans.length} records`;

  const itemHtml = `
    <div class="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs animate-slide-down">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full ${isSuccess ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
        <div>
          <div class="font-semibold text-white flex items-center gap-1.5">
            ${claim.participant_name}
            <span class="text-[10px] text-slate-400 font-mono">(${claim.participant_id})</span>
          </div>
          <div class="text-[11px] text-slate-400">
            ${claim.team_name || 'Medaithon'} • ${formatClockTime(claim.claimed_at)}
          </div>
        </div>
      </div>
      <div>
        ${getDietBadge(claim.diet_pref)}
      </div>
    </div>
  `;

  if (myCounterScans.length === 1) {
    container.innerHTML = itemHtml;
  } else {
    container.insertAdjacentHTML('afterbegin', itemHtml);
  }
}

// Quick Sample Scan helper
window.quickScan = function(id) {
  barcodeInput.value = id;
  handleBarcodeSubmit();
};

// ---------------- CAMERA SCANNER LOGIC ---------------- //

async function toggleCamera() {
  if (isCameraRunning) {
    stopCamera();
  } else {
    startCamera();
  }
}

async function startCamera() {
  if (typeof Html5Qrcode === 'undefined') {
    showToast('Camera library loading error. Please refresh.', 'error');
    return;
  }

  cameraPlaceholder.classList.add('hidden');
  scanLaserLine.classList.remove('hidden');

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("qr-reader");
  }

  const config = {
    fps: 15,
    qrbox: { width: 250, height: 180 },
    aspectRatio: 1.333334,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.UPC_A
    ]
  };

  try {
    await html5QrCode.start(
      { facingMode: "environment" }, // Prefer rear camera on mobile
      config,
      (decodedText, decodedResult) => {
        // Scanned successfully from camera viewfinder
        console.log('[Camera Scanned]:', decodedText);
        processScan(decodedText);
      },
      (errorMessage) => {
        // Standard non-matching frame parse, ignore to avoid spamming console
      }
    );

    isCameraRunning = true;
    cameraBtnText.textContent = 'Pause Camera';
    btnToggleCamera.className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition';
    showToast('Camera scanner started 📷', 'success');
  } catch (err) {
    console.error('Camera start error:', err);
    stopCamera();
    showToast('Unable to open camera. Check permissions or use manual input.', 'error');
  }
}

async function stopCamera() {
  if (html5QrCode && isCameraRunning) {
    try {
      await html5QrCode.stop();
    } catch (e) {
      console.warn('Error stopping camera:', e);
    }
  }
  isCameraRunning = false;
  cameraPlaceholder.classList.remove('hidden');
  scanLaserLine.classList.add('hidden');
  cameraBtnText.textContent = 'Start Camera';
  btnToggleCamera.className = 'px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition';
}

// ---------------- WALKIN REGISTRATION MODAL ---------------- //

function openWalkinModal(prefillId = '') {
  walkinId.value = prefillId || `MED-${Math.floor(1000 + Math.random() * 9000)}`;
  document.getElementById('walkinName').value = '';
  document.getElementById('walkinCollege').value = '';
  document.getElementById('walkinTeam').value = '';
  modalWalkin.classList.remove('hidden');
  setTimeout(() => document.getElementById('walkinName').focus(), 100);
}

function closeWalkinModal() {
  modalWalkin.classList.add('hidden');
  barcodeInput.focus();
}

async function handleWalkinSubmit(e) {
  e.preventDefault();

  const id = walkinId.value.trim();
  const name = document.getElementById('walkinName').value.trim();
  const college = document.getElementById('walkinCollege').value.trim();
  const team_name = document.getElementById('walkinTeam').value.trim();
  const diet_pref = document.querySelector('input[name="walkinDiet"]:checked').value;
  const autoClaim = document.getElementById('walkinAutoClaim').checked;

  if (!id || !name) {
    showToast('ID and Name are required!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/participants/manual-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        college,
        team_name,
        diet_pref,
        autoClaim,
        counterId: selectCounter.value,
        volunteerName: inputVolunteerName.value
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      closeWalkinModal();
      showToast(data.message, 'success');
      if (data.claim) {
        handleSuccess(data.claim, data.stats);
      } else {
        showToast(`Participant ${name} added!`, 'success');
      }
    } else {
      showToast(data.message || 'Error registering walk-in', 'error');
    }
  } catch (err) {
    console.error('Walkin submission error:', err);
    showToast('Connection error during walk-in registration', 'error');
  }
}
