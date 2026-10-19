import React, { useState } from 'react';
import { useFoodSystem } from '../context/FoodSystemContext';
import {
  Utensils,
  CheckCircle,
  Hourglass,
  PieChart,
  Radio,
  Maximize2,
  TrendingUp,
  Inbox,
  GitBranch,
  BarChart2
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function LiveDashboard() {
  const { stats } = useFoodSystem();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false));
      }
    }
  };

  const total = stats.total_target || 1;
  const claimed = stats.claimed_count || 0;
  const pct = Math.min(100, Math.round((claimed / total) * 100));
  const remainingPct = Math.max(0, 100 - pct);

  // Velocity Chart data
  const velocityLabels = stats.hourly_velocity?.map((v) => v.hour) || ['12:00', '13:00', '14:00', '15:00'];
  const velocityCounts = stats.hourly_velocity?.map((v) => v.count) || [0, 0, 0, 0];

  const chartData = {
    labels: velocityLabels,
    datasets: [
      {
        label: 'Meals Claimed',
        data: velocityCounts,
        backgroundColor: 'rgba(99, 102, 241, 0.75)',
        borderColor: '#818cf8',
        borderWidth: 1,
        borderRadius: 6
      }
    ]
  };

  const chartOptions = {
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
  };

  const counterKeys = Object.keys(stats.counters || {});

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Session Hero Banner */}
      <div className="glass-panel-elevated p-6 border-indigo-500/20 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900/80">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                ACTIVE MEAL SESSION
              </span>
              <span className="text-xs text-slate-400 font-mono ml-2">
                {stats.session?.date || '2026-10-18'}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {stats.session ? stats.session.name : 'Day 1 - Lunch (Medaithon Grand Feast)'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Window: <span className="font-mono text-slate-200 font-semibold">{stats.session?.start_time || '12:30'} - {stats.session?.end_time || '15:00'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleFullscreen}
              className="px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Projector Mode'}</span>
            </button>

            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-xl">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Counters</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {counterKeys.map((c) => (
                    <span key={c} className="badge-counter text-[10px]">{c}</span>
                  ))}
                  {counterKeys.length === 0 && (
                    <span className="text-slate-500 text-xs">Ready</span>
                  )}
                </div>
              </div>
              <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Quota */}
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Quota</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl md:text-4xl font-black text-white font-mono">
            {stats.total_target.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex justify-between">
            <span>Configured meals</span>
            <span className="text-indigo-400 font-semibold">100%</span>
          </div>
        </div>

        {/* Claimed */}
        <div className="glass-panel p-5 border-emerald-500/30">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Meals Claimed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl md:text-4xl font-black text-emerald-400 font-mono">
            {claimed.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex justify-between">
            <span>Served so far</span>
            <span className="text-emerald-400 font-bold font-mono">{pct}%</span>
          </div>
        </div>

        {/* Remaining */}
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Remaining</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Hourglass className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl md:text-4xl font-black text-cyan-400 font-mono">
            {stats.remaining_count.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex justify-between">
            <span>Trays available</span>
            <span className="text-cyan-400 font-bold font-mono">{remainingPct}%</span>
          </div>
        </div>

        {/* Diet Breakdown */}
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Diet Breakdown</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xl md:text-2xl font-black text-emerald-400 font-mono">{stats.veg_claimed}</div>
              <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> VEG
              </div>
            </div>
            <div className="h-7 w-[1px] bg-slate-800" />
            <div>
              <div className="text-xl md:text-2xl font-black text-rose-400 font-mono">{stats.non_veg_claimed}</div>
              <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> NON-VEG
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">Active session claims</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="glass-panel p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Meal Distribution Progress
          </span>
          <span className="font-mono text-indigo-400">{pct}% Completed ({claimed}/{total} served)</span>
        </div>
        <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-700 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Main Grid: Live Claims Stream (7 cols) + Charts (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real-time Claims Stream */}
        <div className="lg:col-span-7 glass-panel p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="font-bold text-white text-base">Real-time Claims Stream</h3>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              {stats.recent_claims?.length || 0} claims logged
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1.5 flex-1">
            {!stats.recent_claims || stats.recent_claims.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Waiting for incoming volunteer scans...</p>
              </div>
            ) : (
              stats.recent_claims.map((c) => {
                const isVeg = (c.diet_pref || '').toLowerCase() === 'veg';

                return (
                  <div
                    key={c.claim_id}
                    className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/90 hover:border-indigo-500/30 transition flex items-center justify-between gap-3 animate-slide-down"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl ${
                          isVeg
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        } flex items-center justify-center font-bold text-sm shrink-0`}
                      >
                        {c.participant_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm truncate">{c.participant_name}</h4>
                          <span className="font-mono text-[11px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20 shrink-0">
                            {c.participant_id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          <span>{c.college || 'Medaithon'}</span> • <span className="text-slate-300 font-medium">{c.team_name || 'Individual'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="badge-counter text-[11px]">{c.counter_id}</span>
                        <span className={isVeg ? 'badge-veg' : 'badge-nonveg'}>
                          {c.diet_pref?.toUpperCase() || 'VEG'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(c.claimed_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Counter Breakdown & Hourly Velocity (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Counter Split */}
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-cyan-400" />
                Counter-wise Split
              </h3>
              <span className="text-xs text-slate-400 font-mono">Real-time</span>
            </div>

            <div className="space-y-3">
              {counterKeys.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">No counters active yet.</p>
              ) : (
                counterKeys.map((c) => {
                  const count = stats.counters[c] || 0;
                  const share = claimed > 0 ? Math.round((count / claimed) * 100) : 0;

                  return (
                    <div key={c} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-white flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          {c}
                        </span>
                        <span className="font-mono text-indigo-300">
                          {count} meals <span className="text-slate-500 font-normal">({share}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Hourly Velocity Chart */}
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                Hourly Distribution Velocity
              </h3>
              <span className="text-xs text-slate-400 font-mono">Paced Flow</span>
            </div>
            <div className="relative h-[200px] w-full">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
