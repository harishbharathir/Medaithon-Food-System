// Admin Portal Logic: Meal Session CRUD, Live Quota Updates, Manual Entry & Directory

let socket = null;
let currentActiveSession = null;

// DOM Elements
const activeSessionId = document.getElementById('activeSessionId');
const quickSessionName = document.getElementById('quickSessionName');
const quickSessionTarget = document.getElementById('quickSessionTarget');
const quickSessionStart = document.getElementById('quickSessionStart');
const quickSessionEnd = document.getElementById('quickSessionEnd');
const formQuickEditSession = document.getElementById('formQuickEditSession');

const formManualEntry = document.getElementById('formManualEntry');
const manualId = document.getElementById('manualId');
const btnGenRandomId = document.getElementById('btnGenRandomId');

const sessionsListContainer = document.getElementById('sessionsListContainer');
const modalNewSession = document.getElementById('modalNewSession');
const formNewSession = document.getElementById('formNewSession');

const participantTableBody = document.getElementById('participantTableBody');
const searchParticipant = document.getElementById('searchParticipant');
const participantTotalCount = document.getElementById('participantTotalCount');
const btnResetClaims = document.getElementById('btnResetClaims');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  initSocket();

  // Load Initial Data
  loadActiveSession();
  loadSessions();
  loadParticipants();

  // Quick edit form submit
  formQuickEditSession.addEventListener('submit', handleQuickEditSession);

  // Manual entry form submit
  formManualEntry.addEventListener('submit', handleManualEntrySubmit);

  // Generate random ID button
  btnGenRandomId.addEventListener('click', () => {
    manualId.value = `MED-WALK${Math.floor(100 + Math.random() * 900)}`;
  });

  // Modal open/close
  document.getElementById('btnOpenNewSessionModal').addEventListener('click', openNewSessionModal);
  formNewSession.addEventListener('submit', handleNewSessionSubmit);

  // Search participant input with debounce
  let searchTimeout = null;
  searchParticipant.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadParticipants, 300);
  });

  // Reset claims
  btnResetClaims.addEventListener('click', handleResetClaims);

  refreshIcons();
});

// Socket.io for Real-time Admin Sync
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('[Admin Socket] Connected:', socket.id);
  });

  socket.on('meal_claimed', () => {
    // Refresh sessions list count when a scan occurs
    loadSessions();
  });

  socket.on('session_updated', () => {
    loadActiveSession();
    loadSessions();
  });
}

// ---------------- 1. ACTIVE SESSION QUICK EDIT ---------------- //

async function loadActiveSession() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success && json.data && json.data.session) {
      const s = json.data.session;
      currentActiveSession = s;
      activeSessionId.value = s.id;
      quickSessionName.value = s.name;
      quickSessionTarget.value = s.total_target;
      quickSessionStart.value = s.start_time || '';
      quickSessionEnd.value = s.end_time || '';
    }
  } catch (err) {
    console.error('Error loading active session:', err);
  }
}

async function handleQuickEditSession(e) {
  e.preventDefault();
  const id = activeSessionId.value;
  if (!id) {
    showToast('No active session selected', 'error');
    return;
  }

  const payload = {
    name: quickSessionName.value.trim(),
    total_target: parseInt(quickSessionTarget.value, 10),
    start_time: quickSessionStart.value.trim(),
    end_time: quickSessionEnd.value.trim()
  };

  try {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✅ Active meal session & quota updated live across all counters!', 'success');
      loadSessions();
    } else {
      showToast(data.message || 'Error updating session', 'error');
    }
  } catch (err) {
    console.error('Error saving session:', err);
    showToast('Failed to save session updates', 'error');
  }
}

// ---------------- 2. ALL SESSIONS MANAGEMENT ---------------- //

async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const sessions = json.data;
    if (sessions.length === 0) {
      sessionsListContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No sessions created yet.</p>';
      return;
    }

    sessionsListContainer.innerHTML = sessions.map(s => {
      const isActive = s.is_active === 1;
      const claimed = s.claimed_count || 0;
      const pct = s.total_target > 0 ? Math.min(100, Math.round((claimed / s.total_target) * 100)) : 0;

      return `
        <div class="p-3.5 rounded-xl ${isActive ? 'bg-indigo-950/40 border-indigo-500/50 glow-primary' : 'bg-slate-900/60 border-slate-800'} border transition-all">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                ${isActive ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ACTIVE</span>' : ''}
                <span class="text-xs text-slate-400 font-mono">${s.date} • ${s.start_time || '--:--'} - ${s.end_time || '--:--'}</span>
              </div>
              <h4 class="font-bold text-white text-sm truncate">${s.name}</h4>
              <div class="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span>Target: <strong class="text-white font-mono">${s.total_target}</strong></span>
                <span>Claimed: <strong class="text-emerald-400 font-mono">${claimed} (${pct}%)</strong></span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              ${!isActive ? `
                <button onclick="activateSession(${s.id})" class="btn-primary text-xs py-1.5 px-2.5">
                  Activate
                </button>
              ` : `
                <span class="text-xs font-semibold text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">Active Now</span>
              `}
              <button onclick="deleteSession(${s.id}, '${escapeHtml(s.name)}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition" title="Delete Session">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    refreshIcons();
  } catch (err) {
    console.error('Error loading sessions:', err);
  }
}

// Activate Session
window.activateSession = async function(id) {
  try {
    const res = await fetch(`/api/sessions/${id}/activate`, { method: 'POST' });
    const json = await res.json();
    if (res.ok && json.success) {
      showToast('Switched active session successfully!', 'success');
      loadActiveSession();
      loadSessions();
    } else {
      showToast(json.message || 'Error activating session', 'error');
    }
  } catch (err) {
    showToast('Failed to switch active session', 'error');
  }
};

// Delete Session
window.deleteSession = async function(id, name) {
  if (!confirm(`Are you sure you want to delete meal session "${name}"?`)) return;

  try {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (res.ok && json.success) {
      showToast('Session deleted', 'info');
      loadSessions();
      loadActiveSession();
    } else {
      showToast(json.message || 'Error deleting session', 'error');
    }
  } catch (err) {
    showToast('Failed to delete session', 'error');
  }
};

// New Session Modal
function openNewSessionModal() {
  document.getElementById('newSessionDate').value = new Date().toISOString().split('T')[0];
  modalNewSession.classList.remove('hidden');
}

function closeNewSessionModal() {
  modalNewSession.classList.add('hidden');
}

async function handleNewSessionSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('newSessionName').value.trim();
  const date = document.getElementById('newSessionDate').value;
  const total_target = parseInt(document.getElementById('newSessionTarget').value, 10);
  const start_time = document.getElementById('newSessionStart').value.trim();
  const end_time = document.getElementById('newSessionEnd').value.trim();
  const is_active = document.getElementById('newSessionActive').checked;

  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, date, total_target, start_time, end_time, is_active })
    });

    const json = await res.json();
    if (res.ok && json.success) {
      closeNewSessionModal();
      showToast(`Created session: ${name}`, 'success');
      formNewSession.reset();
      loadSessions();
      if (is_active) loadActiveSession();
    } else {
      showToast(json.message || 'Error creating session', 'error');
    }
  } catch (err) {
    showToast('Failed to create new session', 'error');
  }
}

// ---------------- 3. MANUAL ENTRY FOR WALK-INS ---------------- //

async function handleManualEntrySubmit(e) {
  e.preventDefault();

  const id = manualId.value.trim();
  const name = document.getElementById('manualName').value.trim();
  const college = document.getElementById('manualCollege').value.trim();
  const team_name = document.getElementById('manualTeam').value.trim();
  const email = document.getElementById('manualEmail').value.trim();
  const phone = document.getElementById('manualPhone').value.trim();
  const diet_pref = document.querySelector('input[name="manualDiet"]:checked').value;
  const notes = document.getElementById('manualNotes').value.trim();
  const autoClaim = document.getElementById('manualAutoClaim').checked;

  if (!id || !name) {
    showToast('Participant ID and Name are required!', 'error');
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
        email,
        phone,
        diet_pref,
        notes,
        autoClaim,
        counterId: 'Admin Desk',
        volunteerName: 'Admin'
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`✅ ${data.message}`, 'success');
      playSuccessChime();
      formManualEntry.reset();
      document.querySelector('input[name="manualDiet"][value="Veg"]').checked = true;
      document.getElementById('manualAutoClaim').checked = true;
      loadParticipants();
    } else {
      showToast(data.message || 'Error saving participant', 'error');
    }
  } catch (err) {
    console.error('Manual entry error:', err);
    showToast('Failed to register participant', 'error');
  }
}

// ---------------- 4. PARTICIPANTS DIRECTORY ---------------- //

async function loadParticipants() {
  const query = searchParticipant.value.trim();
  try {
    const url = query ? `/api/participants?search=${encodeURIComponent(query)}` : '/api/participants';
    const res = await fetch(url);
    const json = await res.json();

    if (!json.success || !json.data) return;

    const list = json.data;
    participantTotalCount.textContent = `Showing ${list.length} registered participant${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      participantTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-500">
            No participants found matching "${escapeHtml(query)}"
          </td>
        </tr>
      `;
      return;
    }

    participantTableBody.innerHTML = list.map(p => {
      const isManual = p.is_manual_entry === 1;

      return `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-2.5 px-3 font-bold text-indigo-400">${p.id}</td>
          <td class="py-2.5 px-3 font-sans font-semibold text-white">${p.name}</td>
          <td class="py-2.5 px-3 font-sans text-slate-300">${p.college || '-'}</td>
          <td class="py-2.5 px-3 font-sans text-slate-300">${p.team_name || '-'}</td>
          <td class="py-2.5 px-3">${getDietBadge(p.diet_pref)}</td>
          <td class="py-2.5 px-3 font-sans">
            ${isManual ? '<span class="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">WALK-IN</span>' : '<span class="text-[10px] text-slate-400">PRE-REG</span>'}
          </td>
          <td class="py-2.5 px-3 text-right">
            <button onclick="deleteParticipant('${p.id}', '${escapeHtml(p.name)}')" class="p-1 rounded text-slate-500 hover:text-rose-400 transition" title="Delete">
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    refreshIcons();
  } catch (err) {
    console.error('Error loading participants:', err);
  }
}

window.deleteParticipant = async function(id, name) {
  if (!confirm(`Delete participant ${name} (${id})?`)) return;
  try {
    const res = await fetch(`/api/participants/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (res.ok && json.success) {
      showToast(`Removed participant ${name}`, 'info');
      loadParticipants();
    } else {
      showToast('Error removing participant', 'error');
    }
  } catch (err) {
    showToast('Failed to delete participant', 'error');
  }
};

// ---------------- 5. RESET CLAIMS UTILITY ---------------- //

async function handleResetClaims() {
  if (!currentActiveSession) {
    showToast('No active session to reset', 'error');
    return;
  }

  const confirmMsg = `Reset ALL meal claims for "${currentActiveSession.name}"?\n\nThis will reset the claimed counter to 0 for this session so you can test scans again.`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/admin/reset-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentActiveSession.id })
    });

    const json = await res.json();
    if (res.ok && json.success) {
      showToast('Meal claims reset to 0 for this session!', 'success');
      loadSessions();
    } else {
      showToast('Error resetting claims', 'error');
    }
  } catch (err) {
    showToast('Failed to reset claims', 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
