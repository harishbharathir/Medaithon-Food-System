// Participant Badges & Barcode Sheet Generator

let allParticipants = [];
let currentFilter = 'all';

window.addEventListener('DOMContentLoaded', () => {
  loadBadges();

  const searchInput = document.getElementById('badgeSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderBadges();
    });
  }

  refreshIcons();
});

async function loadBadges() {
  try {
    const res = await fetch('/api/participants?limit=300');
    const json = await res.json();
    if (json.success && json.data) {
      allParticipants = json.data;
      renderBadges();
    }
  } catch (err) {
    console.error('Error loading badge participants:', err);
  }
}

function renderBadges() {
  const container = document.getElementById('badgesContainer');
  const query = (document.getElementById('badgeSearch').value || '').toLowerCase().trim();

  const filtered = allParticipants.filter(p => {
    // Filter by diet
    if (currentFilter !== 'all' && (p.diet_pref || '').toLowerCase() !== currentFilter.toLowerCase()) {
      return false;
    }
    // Filter by search
    if (query) {
      const matchName = (p.name || '').toLowerCase().includes(query);
      const matchId = (p.id || '').toLowerCase().includes(query);
      const matchTeam = (p.team_name || '').toLowerCase().includes(query);
      const matchCollege = (p.college || '').toLowerCase().includes(query);
      return matchName || matchId || matchTeam || matchCollege;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500">
        <p class="text-sm">No badges match the selected filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const isVeg = (p.diet_pref || '').toLowerCase() === 'veg';
    const barcodeCanvasId = `barcode-${p.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return `
      <div class="id-card glass-panel p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between border-slate-700/80 hover:border-indigo-500/50 transition">
        
        <!-- Header -->
        <div class="flex items-start justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
              M
            </div>
            <div>
              <div class="text-[10px] font-bold text-slate-400 tracking-wider uppercase">MEDAITHON 2026</div>
              <div class="text-xs font-bold text-white leading-tight">Participant Badge</div>
            </div>
          </div>
          <div>
            ${getDietBadge(p.diet_pref)}
          </div>
        </div>

        <!-- Body Details -->
        <div class="my-2">
          <h3 class="text-base font-extrabold text-white leading-snug">${p.name}</h3>
          <p class="text-xs text-indigo-400 font-semibold">${p.team_name || 'Individual Participant'}</p>
          <p class="text-[11px] text-slate-400">${p.college || 'Engineering Institute'}</p>
        </div>

        <!-- Barcode Section -->
        <div class="mt-2 pt-2 border-t border-slate-800 flex flex-col items-center justify-center bg-white rounded-xl p-2.5 shadow-inner">
          <svg id="${barcodeCanvasId}" class="id-barcode w-full max-h-[50px]"></svg>
        </div>

        <!-- Quick Scan Test Button (Hidden in print) -->
        <div class="no-print mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
          <span class="text-slate-400 font-mono">${p.id}</span>
          <a href="/scanner.html" onclick="localStorage.setItem('medaithon_test_scan', '${p.id}')" target="_blank" class="text-indigo-400 hover:text-indigo-300 font-medium">
            Scan in Terminal →
          </a>
        </div>

      </div>
    `;
  }).join('');

  // Render Barcodes via JsBarcode
  filtered.forEach(p => {
    const canvasId = `#barcode-${p.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    try {
      if (typeof JsBarcode === 'function') {
        JsBarcode(canvasId, p.id, {
          format: "CODE128",
          width: 1.8,
          height: 40,
          displayValue: true,
          fontSize: 12,
          font: "JetBrains Mono",
          background: "#ffffff",
          lineColor: "#000000",
          margin: 0
        });
      }
    } catch (err) {
      console.warn(`JsBarcode error for ${p.id}:`, err);
    }
  });

  refreshIcons();
}

window.filterBadges = function(filter) {
  currentFilter = filter;
  document.querySelectorAll('.badge-filter').forEach(btn => {
    if (btn.getAttribute('data-filter') === filter) {
      btn.className = 'badge-filter px-3 py-1 rounded-lg bg-indigo-600 text-white font-medium';
    } else {
      btn.className = 'badge-filter px-3 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700';
    }
  });
  renderBadges();
};
