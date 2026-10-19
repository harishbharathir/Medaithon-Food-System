// Live Projector Dashboard Logic (Real-time WebSockets + Charts + Feed)

let socket = null;
let velocityChart = null;
let currentStats = null;
let soundEnabled = true;

// DOM Elements
const liveClock = document.getElementById('liveClock');
const activeSessionTitle = document.getElementById('activeSessionTitle');
const activeSessionHours = document.getElementById('activeSessionHours');
const sessionDate = document.getElementById('sessionDate');
const statTotalQuota = document.getElementById('statTotalQuota');
const statClaimedCount = document.getElementById('statClaimedCount');
const statClaimedPercentage = document.getElementById('statClaimedPercentage');
const statRemainingCount = document.getElementById('statRemainingCount');
const statRemainingPercentage = document.getElementById('statRemainingPercentage');
const statVegCount = document.getElementById('statVegCount');
const statNonVegCount = document.getElementById('statNonVegCount');
const mainProgressBar = document.getElementById('mainProgressBar');
const progressBarText = document.getElementById('progressBarText');
const liveClaimFeed = document.getElementById('liveClaimFeed');
const liveFeedCounter = document.getElementById('liveFeedCounter');
const counterDistributionList = document.getElementById('counterDistributionList');
const counterBadges = document.getElementById('counterBadges');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  // Start Clock
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // Fullscreen toggle
  const btnFullscreen = document.getElementById('btnFullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', toggleFullscreen);
  }

  // Sound toggle
  const btnSoundToggle = document.getElementById('btnSoundToggle');
  const iconSound = document.getElementById('iconSound');
  if (btnSoundToggle) {
    const saved = localStorage.getItem('medaithon_dashboard_sound');
    soundEnabled = saved !== 'false';
    updateSoundIcon();

    btnSoundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      localStorage.setItem('medaithon_dashboard_sound', soundEnabled);
      updateSoundIcon();
      showToast(soundEnabled ? 'Live chime enabled 🔔' : 'Live chime muted 🔕', 'info');
    });
  }

  function updateSoundIcon() {
    if (iconSound) {
      iconSound.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
      refreshIcons();
    }
  }

  // Initialize Velocity Chart
  initChart();

  // Initialize Socket.io
  initSocket();

  // Initial fetch
  fetchStats();

  refreshIcons();
});

// Live Clock
function updateLiveClock() {
  if (liveClock) {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

// Fullscreen Toggle
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn('Fullscreen request failed:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// Socket.io Real-time connection
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('[Dashboard Socket] Connected:', socket.id);
  });

  socket.on('initial_stats', (data) => {
    if (data && data.stats) {
      applyStats(data.stats, false);
      if (data.stats.recent_claims) {
        renderInitialFeed(data.stats.recent_claims);
      }
    }
  });

  socket.on('stats_update', (data) => {
    if (data && data.stats) {
      applyStats(data.stats, true);
    }
  });

  // REAL-TIME MEAL CLAIMED: Incoming scan from Counter 1, Counter 2, etc.
  socket.on('meal_claimed', (data) => {
    const { claim, stats } = data;
    if (stats) applyStats(stats, true);

    if (claim) {
      appendClaimToFeed(claim);
      if (soundEnabled) {
        playSuccessChime();
      }

      // Check for milestone confetti
      if (stats && (stats.claimed_count === 50 || stats.claimed_count === 100 || stats.claimed_count % 100 === 0)) {
        triggerConfetti();
      }
    }
  });

  socket.on('session_updated', (data) => {
    if (data && data.stats) {
      applyStats(data.stats, true);
      if (data.stats.recent_claims) {
        renderInitialFeed(data.stats.recent_claims);
      }
    }
    showToast('Meal session updated by Admin!', 'info');
  });
}

// REST fallback
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success && json.data) {
      applyStats(json.data, false);
      if (json.data.recent_claims) {
        renderInitialFeed(json.data.recent_claims);
      }
    }
  } catch (err) {
    console.error('Failed to fetch dashboard stats:', err);
  }
}

// Apply Stats to UI with smooth animations
function applyStats(stats, isLiveUpdate = true) {
  currentStats = stats;
  const session = stats.session;

  if (session) {
    activeSessionTitle.textContent = session.name;
    activeSessionHours.textContent = `${session.start_time || '--:--'} - ${session.end_time || '--:--'}`;
    sessionDate.textContent = session.date || '';
    statTotalQuota.textContent = stats.total_target.toLocaleString();
  } else {
    activeSessionTitle.textContent = 'No Active Meal Session';
    activeSessionHours.textContent = '--:--';
    sessionDate.textContent = '';
    statTotalQuota.textContent = '0';
  }

  // Animate Numbers
  const prevClaimed = parseInt(statClaimedCount.textContent.replace(/,/g, '')) || 0;
  const prevRemaining = parseInt(statRemainingCount.textContent.replace(/,/g, '')) || 0;
  const prevVeg = parseInt(statVegCount.textContent.replace(/,/g, '')) || 0;
  const prevNonVeg = parseInt(statNonVegCount.textContent.replace(/,/g, '')) || 0;

  animateNumber(statClaimedCount, prevClaimed, stats.claimed_count || 0);
  animateNumber(statRemainingCount, prevRemaining, stats.remaining_count || 0);
  animateNumber(statVegCount, prevVeg, stats.veg_claimed || 0);
  animateNumber(statNonVegCount, prevNonVeg, stats.non_veg_claimed || 0);

  // Percentages & Progress Bar
  const total = stats.total_target || 1;
  const claimed = stats.claimed_count || 0;
  const pct = Math.min(100, Math.round((claimed / total) * 100));
  const remainingPct = Math.max(0, 100 - pct);

  statClaimedPercentage.textContent = `${pct}%`;
  statRemainingPercentage.textContent = `${remainingPct}%`;
  progressBarText.textContent = `${pct}% (${claimed}/${total} meals served)`;
  mainProgressBar.style.width = `${pct}%`;

  // Render Counter Breakdown
  renderCounterBreakdown(stats.counters || {});

  // Update Chart
  updateChart(stats.hourly_velocity || []);
}

// Render Initial Feed items
function renderInitialFeed(claims) {
  if (!claims || claims.length === 0) {
    liveClaimFeed.innerHTML = `
      <div class="text-center py-12 text-slate-500">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 opacity-40"></i>
        <p class="text-sm font-medium">Waiting for incoming scans...</p>
      </div>
    `;
    liveFeedCounter.textContent = '0 recent';
    refreshIcons();
    return;
  }

  liveFeedCounter.textContent = `${claims.length} recent`;
  liveClaimFeed.innerHTML = claims.map(c => generateClaimCardHtml(c)).join('');
  refreshIcons();
}

// Append new incoming real-time claim to the top of feed with animation
function appendClaimToFeed(claim) {
  // If waiting placeholder was showing, clear it
  if (liveClaimFeed.querySelector('.text-center')) {
    liveClaimFeed.innerHTML = '';
  }

  const cardHtml = generateClaimCardHtml(claim);
  liveClaimFeed.insertAdjacentHTML('afterbegin', cardHtml);

  // Update badge count
  const currentCount = liveClaimFeed.children.length;
  liveFeedCounter.textContent = `${currentCount} recent`;

  // Limit feed to last 50 DOM elements for smooth performance
  if (currentCount > 50) {
    liveClaimFeed.lastElementChild.remove();
  }

  refreshIcons();
}

// HTML Generator for Claim Card
function generateClaimCardHtml(claim) {
  const isVeg = (claim.diet_pref || '').toLowerCase() === 'veg';
  const timeFormatted = formatClockTime(claim.claimed_at);
  const timeAgo = formatTimeAgo(claim.claimed_at);

  return `
    <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-indigo-500/30 transition-all flex items-center justify-between gap-3 animate-slide-down">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Avatar / Status indicator -->
        <div class="w-10 h-10 rounded-xl ${isVeg ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'} flex items-center justify-center font-bold text-sm flex-shrink-0">
          ${claim.participant_name.charAt(0).toUpperCase()}
        </div>
        
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-white text-sm truncate">${claim.participant_name}</h4>
            <span class="font-mono text-[11px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20 flex-shrink-0">
              ${claim.participant_id}
            </span>
          </div>
          <p class="text-xs text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
            <span>${claim.college || 'Medaithon'}</span>
            <span>•</span>
            <span class="text-slate-300 font-medium">${claim.team_name || 'Individual'}</span>
          </p>
        </div>
      </div>

      <!-- Right: Counter, Diet Badge & Timestamp -->
      <div class="text-right flex-shrink-0 flex flex-col items-end gap-1">
        <div class="flex items-center gap-1.5">
          <span class="badge-counter text-[11px]">${claim.counter_id}</span>
          ${getDietBadge(claim.diet_pref)}
        </div>
        <div class="text-[11px] text-slate-400 font-mono">
          ${timeFormatted} <span class="text-slate-500">(${timeAgo})</span>
        </div>
      </div>
    </div>
  `;
}

// Render Counter-wise Split
function renderCounterBreakdown(counterMap) {
  const keys = Object.keys(counterMap);
  if (keys.length === 0) {
    counterDistributionList.innerHTML = `
      <p class="text-xs text-slate-500 text-center py-2">No counters active yet.</p>
    `;
    return;
  }

  // Update top active counter badges
  counterBadges.innerHTML = keys.map(k => `<span class="badge-counter">${k}</span>`).join('');

  // Calculate sum of all counters
  const totalClaimed = Object.values(counterMap).reduce((a, b) => a + b, 0) || 1;

  counterDistributionList.innerHTML = keys.map(counter => {
    const count = counterMap[counter];
    const pct = Math.round((count / totalClaimed) * 100);

    return `
      <div class="space-y-1">
        <div class="flex items-center justify-between text-xs font-semibold">
          <span class="text-white flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
            ${counter}
          </span>
          <span class="font-mono text-indigo-300">${count.toLocaleString()} meals <span class="text-slate-400">(${pct}%)</span></span>
        </div>
        <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div class="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Chart.js Velocity Graph
function initChart() {
  const ctx = document.getElementById('velocityChart');
  if (!ctx || typeof Chart === 'undefined') return;

  velocityChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['12:00', '13:00', '14:00', '15:00'],
      datasets: [{
        label: 'Meals Claimed',
        data: [0, 0, 0, 0],
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: '#818cf8',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
        }
      }
    }
  });
}

function updateChart(velocityData) {
  if (!velocityChart) return;
  if (!velocityData || velocityData.length === 0) return;

  const labels = velocityData.map(v => v.hour);
  const data = velocityData.map(v => v.count);

  velocityChart.data.labels = labels;
  velocityChart.data.datasets[0].data = data;
  velocityChart.update();
}
