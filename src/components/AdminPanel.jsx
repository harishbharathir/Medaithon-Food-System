import React, { useState, useEffect, useCallback } from 'react';
import { useFoodSystem } from '../context/FoodSystemContext';
import {
  ShieldCheck,
  Save,
  PlusCircle,
  UserPlus,
  RefreshCw,
  Trash2,
  Download,
  Search,
  Check
} from 'lucide-react';

export default function AdminPanel() {
  const { stats, refreshStats, addToast, registerManualWalkin } = useFoodSystem();

  // Active Session Quick Edit
  const [sessionForm, setSessionForm] = useState({
    name: '',
    total_target: 350,
    start_time: '12:30',
    end_time: '15:00'
  });

  // Manual Walk-in Form
  const [manualForm, setManualForm] = useState({
    id: '',
    name: '',
    college: '',
    team_name: '',
    email: '',
    phone: '',
    diet_pref: 'Veg',
    notes: '',
    autoClaim: true
  });

  // All Sessions List
  const [sessions, setSessions] = useState([]);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionForm, setNewSessionForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    total_target: 350,
    start_time: '12:30',
    end_time: '15:00',
    is_active: false
  });

  // Participant Directory
  const [participants, setParticipants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync form with current active session
  useEffect(() => {
    if (stats.session) {
      setSessionForm({
        name: stats.session.name || '',
        total_target: stats.session.total_target || 350,
        start_time: stats.session.start_time || '12:30',
        end_time: stats.session.end_time || '15:00'
      });
    }
  }, [stats.session]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      const json = await res.json();
      if (json.success && json.data) {
        setSessions(json.data);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }, []);

  const loadParticipants = useCallback(async (query = '') => {
    try {
      const url = query ? `/api/participants?search=${encodeURIComponent(query)}` : '/api/participants';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setParticipants(json.data);
      }
    } catch (err) {
      console.error('Failed to load participants:', err);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadParticipants();
  }, [loadSessions, loadParticipants]);

  // Handle Quick Session Save
  const handleQuickSessionSave = async (e) => {
    e.preventDefault();
    if (!stats.session?.id) return;

    try {
      const res = await fetch(`/api/sessions/${stats.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionForm.name.trim(),
          total_target: parseInt(sessionForm.total_target, 10),
          start_time: sessionForm.start_time.trim(),
          end_time: sessionForm.end_time.trim()
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        addToast('✅ Active meal session & quota updated live across all counters!', 'success');
        refreshStats();
        loadSessions();
      } else {
        addToast(json.message || 'Error updating session', 'error');
      }
    } catch (err) {
      addToast('Failed to update session', 'error');
    }
  };

  // Handle Manual Walk-in Submit
  const handleManualWalkinSubmit = async (e) => {
    e.preventDefault();
    const res = await registerManualWalkin({
      ...manualForm,
      counterId: 'Admin Desk',
      volunteerName: 'Admin'
    });

    if (res.success) {
      setManualForm({
        id: '',
        name: '',
        college: '',
        team_name: '',
        email: '',
        phone: '',
        diet_pref: 'Veg',
        notes: '',
        autoClaim: true
      });
      loadParticipants();
    }
  };

  // Activate session
  const activateSession = async (id) => {
    try {
      const res = await fetch(`/api/sessions/${id}/activate`, { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success) {
        addToast('Switched active session!', 'success');
        refreshStats();
        loadSessions();
      }
    } catch (err) {
      addToast('Failed to activate session', 'error');
    }
  };

  // Delete session
  const deleteSession = async (id, name) => {
    if (!confirm(`Delete meal session "${name}"?`)) return;
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        addToast('Session deleted', 'info');
        loadSessions();
        refreshStats();
      }
    } catch (err) {
      addToast('Failed to delete session', 'error');
    }
  };

  // Create new session
  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSessionForm)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowNewSessionModal(false);
        addToast(`Created session: ${newSessionForm.name}`, 'success');
        loadSessions();
        if (newSessionForm.is_active) refreshStats();
      }
    } catch (err) {
      addToast('Failed to create session', 'error');
    }
  };

  // Delete participant
  const deleteParticipant = async (id, name) => {
    if (!confirm(`Delete participant ${name} (${id})?`)) return;
    try {
      const res = await fetch(`/api/participants/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        addToast(`Removed ${name}`, 'info');
        loadParticipants(searchQuery);
      }
    } catch (err) {
      addToast('Error removing participant', 'error');
    }
  };

  // Reset claims
  const handleResetClaims = async () => {
    if (!stats.session) return;
    if (!confirm(`Reset ALL meal claims for "${stats.session.name}" to 0?`)) return;

    try {
      const res = await fetch('/api/admin/reset-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stats.session.id })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        addToast('Meal claims reset for current session', 'success');
        refreshStats();
        loadSessions();
      }
    } catch (err) {
      addToast('Error resetting claims', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner & Active Session Quota Editor */}
      <div className="glass-panel-elevated p-6 border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Meal Session & Quota Control
            </span>
            <h2 className="text-xl font-bold text-white">
              Real-time Meal Target & Configuration
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Updating quota or session name instantly updates all connected volunteer scanners and dashboards!
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewSessionModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add Meal Session
            </button>
            <a
              href="/api/export/csv"
              download
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleQuickSessionSave} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Meal Name</label>
            <input
              type="text"
              required
              value={sessionForm.name}
              onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
              className="glass-input w-full font-semibold text-sm"
              placeholder="e.g. Day 1 - Lunch"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Total Quota (Target Meals)</label>
            <input
              type="number"
              required
              min="1"
              value={sessionForm.total_target}
              onChange={(e) => setSessionForm({ ...sessionForm, total_target: e.target.value })}
              className="glass-input w-full font-mono text-sm font-bold text-emerald-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Timing Window</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={sessionForm.start_time}
                onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })}
                className="glass-input w-full text-xs font-mono"
                placeholder="12:30"
              />
              <input
                type="text"
                value={sessionForm.end_time}
                onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })}
                className="glass-input w-full text-xs font-mono"
                placeholder="15:00"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow-lg transition"
            >
              <Save className="w-4 h-4" />
              Update Live
            </button>
          </div>
        </form>
      </div>

      {/* Grid: Manual Walk-in Form (Left) & All Sessions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Add Manual Walk-in Entry (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-6 border-amber-500/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Add Manual Entry</h3>
              <p className="text-xs text-slate-400">Register participant not listed in DB</p>
            </div>
          </div>

          <form onSubmit={handleManualWalkinSubmit} className="space-y-3 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Barcode / ID *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={manualForm.id}
                  onChange={(e) => setManualForm({ ...manualForm, id: e.target.value.toUpperCase() })}
                  className="glass-input w-full font-mono text-xs uppercase"
                  placeholder="e.g. MED-WALK01"
                />
                <button
                  type="button"
                  onClick={() => setManualForm({ ...manualForm, id: `MED-WALK${Math.floor(100 + Math.random() * 900)}` })}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 whitespace-nowrap"
                >
                  Auto ID
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={manualForm.name}
                onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                className="glass-input w-full text-xs"
                placeholder="Participant Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">College</label>
                <input
                  type="text"
                  value={manualForm.college}
                  onChange={(e) => setManualForm({ ...manualForm, college: e.target.value })}
                  className="glass-input w-full text-xs"
                  placeholder="College"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Team</label>
                <input
                  type="text"
                  value={manualForm.team_name}
                  onChange={(e) => setManualForm({ ...manualForm, team_name: e.target.value })}
                  className="glass-input w-full text-xs"
                  placeholder="Team"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  className="glass-input w-full text-xs"
                  placeholder="Email"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone</label>
                <input
                  type="text"
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  className="glass-input w-full text-xs"
                  placeholder="Phone"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Diet Preference</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="adminDiet"
                    value="Veg"
                    checked={manualForm.diet_pref === 'Veg'}
                    onChange={() => setManualForm({ ...manualForm, diet_pref: 'Veg' })}
                    className="accent-emerald-500"
                  />
                  <span className="text-xs font-bold text-emerald-400">VEG</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="adminDiet"
                    value="Non-Veg"
                    checked={manualForm.diet_pref === 'Non-Veg'}
                    onChange={() => setManualForm({ ...manualForm, diet_pref: 'Non-Veg' })}
                    className="accent-rose-500"
                  />
                  <span className="text-xs font-bold text-rose-400">NON-VEG</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Dietary Notes / Allergies</label>
              <input
                type="text"
                value={manualForm.notes}
                onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                className="glass-input w-full text-xs"
                placeholder="e.g. Peanut allergy"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={manualForm.autoClaim}
                  onChange={(e) => setManualForm({ ...manualForm, autoClaim: e.target.checked })}
                  className="accent-indigo-500 w-4 h-4 rounded"
                />
                <span>Immediately claim active meal upon saving</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 shadow-lg transition"
            >
              <Check className="w-4 h-4" />
              Register & Broadcast to Counters
            </button>
          </form>
        </div>

        {/* Right: Meal Sessions List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Meal Sessions List</h3>
                <p className="text-xs text-slate-400">Switch active session or update quota</p>
              </div>
              <button
                onClick={loadSessions}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {sessions.map((s) => {
                const isActive = s.is_active === 1;
                const claimedCount = s.claimed_count || 0;
                const pct = s.total_target > 0 ? Math.min(100, Math.round((claimedCount / s.total_target) * 100)) : 0;

                return (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isActive
                        ? 'bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ACTIVE
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-mono">
                            {s.date} • {s.start_time || '--:--'} - {s.end_time || '--:--'}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm truncate">{s.name}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span>Target: <strong className="text-white font-mono">{s.total_target}</strong></span>
                          <span>Claimed: <strong className="text-emerald-400 font-mono">{claimedCount} ({pct}%)</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isActive ? (
                          <button
                            onClick={() => activateSession(s.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
                          >
                            Activate
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            Active Now
                          </span>
                        )}
                        <button
                          onClick={() => deleteSession(s.id, s.name)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition"
                          title="Delete Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset Claims Box */}
          <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border-slate-800">
            <div className="text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Testing Utilities:</span> Reset meal claims for active session to test from zero.
            </div>
            <button
              onClick={handleResetClaims}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 border border-rose-800/40 hover:bg-rose-950/40 flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Reset Session Claims
            </button>
          </div>
        </div>
      </div>

      {/* Registered Participants Directory */}
      <div className="glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-base">Registered Participants Directory</h3>
            <p className="text-xs text-slate-400">Showing {participants.length} participants</p>
          </div>

          <div className="flex gap-2 max-w-sm w-full">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  loadParticipants(e.target.value);
                }}
                className="glass-input w-full text-xs pl-8"
                placeholder="Search by ID, Name, College, Team..."
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/80 sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Barcode / ID</th>
                <th className="py-2.5 px-3">Participant Name</th>
                <th className="py-2.5 px-3">College / Inst</th>
                <th className="py-2.5 px-3">Team</th>
                <th className="py-2.5 px-3">Diet</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {participants.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-bold text-indigo-400">{p.id}</td>
                  <td className="py-2.5 px-3 font-sans font-semibold text-white">{p.name}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-300">{p.college || '-'}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-300">{p.team_name || '-'}</td>
                  <td className="py-2.5 px-3">
                    <span className={p.diet_pref?.toLowerCase() === 'veg' ? 'badge-veg' : 'badge-nonveg'}>
                      {p.diet_pref?.toUpperCase() || 'VEG'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    {p.is_manual_entry === 1 ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        WALK-IN
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">PRE-REG</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => deleteParticipant(p.id, p.name)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-elevated max-w-md w-full p-6 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                Create New Meal Session
              </h3>
              <button onClick={() => setShowNewSessionModal(false)} className="text-slate-400 hover:text-white text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Meal Name *</label>
                <input
                  type="text"
                  required
                  value={newSessionForm.name}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, name: e.target.value })}
                  className="glass-input w-full text-xs font-semibold"
                  placeholder="e.g. Day 2 - Lunch & Valedictory"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={newSessionForm.date}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, date: e.target.value })}
                    className="glass-input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Meals *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newSessionForm.total_target}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, total_target: parseInt(e.target.value, 10) })}
                    className="glass-input w-full font-mono text-xs text-emerald-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
                  <input
                    type="text"
                    value={newSessionForm.start_time}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, start_time: e.target.value })}
                    className="glass-input w-full text-xs font-mono"
                    placeholder="12:30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Time</label>
                  <input
                    type="text"
                    value={newSessionForm.end_time}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, end_time: e.target.value })}
                    className="glass-input w-full text-xs font-mono"
                    placeholder="15:00"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={newSessionForm.is_active}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, is_active: e.target.checked })}
                    className="accent-indigo-500 w-4 h-4 rounded"
                  />
                  <span>Set as active session immediately</span>
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex-1"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
