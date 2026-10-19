import React, { useState, useEffect } from 'react';
import { useFoodSystem } from '../context/FoodSystemContext';
import { Scan, Tv, ShieldCheck, QrCode, Columns, Volume2, VolumeX, Clock } from 'lucide-react';

export default function Navbar() {
  const { activeTab, setActiveTab, isConnected, soundEnabled, toggleSound, stats } = useFoodSystem();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const update = () => {
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: 'scanner', label: 'Volunteer Scanner', icon: Scan },
    { id: 'dual', label: 'Dual Counters (Sync)', icon: Columns, highlight: true },
    { id: 'dashboard', label: 'Live Dashboard', icon: Tv },
    { id: 'admin', label: 'Admin Portal', icon: ShieldCheck },
    { id: 'badges', label: 'ID Badges', icon: QrCode },
  ];

  return (
    <header className="max-w-7xl mx-auto w-full mb-6 no-print">
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Active Status */}
        <div className="flex items-center gap-3.5">
          <img
            src="/assets/medai-removebg-preview.png"
            alt="Medaithon Logo"
            className="h-10 w-auto object-contain"
            onError={(e) => { e.currentTarget.src = '/assets/logo.png'; }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Medaithon Food Logistics
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                React v19 • Vite
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {stats.session ? stats.session.name : 'Realtime Food Distribution System'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 flex-wrap">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                } ${item.highlight && !isActive ? 'border border-emerald-500/30 text-emerald-300' : ''}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : item.highlight ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Status Badges & Sound */}
        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{clock || '--:--:--'}</span>
          </div>

          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
            title={soundEnabled ? 'Mute Sounds' : 'Enable Sounds'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>{isConnected ? 'Sync Active' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
