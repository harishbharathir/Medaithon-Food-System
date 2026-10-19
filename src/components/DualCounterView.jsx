import React from 'react';
import ScannerView from './ScannerView';
import { Columns, Zap } from 'lucide-react';
import { useFoodSystem } from '../context/FoodSystemContext';

export default function DualCounterView() {
  const { stats } = useFoodSystem();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Spotlight Banner */}
      <div className="glass-panel-elevated p-5 border-emerald-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-emerald-950/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Real-time Dual Counter Synchronizer
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">
              Counter 1 & Counter 2 Live Simulator
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Test the exact user requirement: Scanning a barcode in Counter 1 increments Counter 2 and the Live Dashboard simultaneously, and blocks double claims in real-time.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-xl">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Total Claimed Across All Counters</div>
              <div className="text-xl font-black text-emerald-400 font-mono">
                {stats.claimed_count} / {stats.total_target}
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Dual Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Counter 1 Terminal */}
        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-indigo-500/20">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-400"></span>
              <h3 className="font-extrabold text-white text-base">Terminal 1: Counter 1 (Main Hall)</h3>
            </div>
            <span className="text-xs font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
              Counter 1
            </span>
          </div>
          <ScannerView overrideCounterId="Counter 1" />
        </div>

        {/* Counter 2 Terminal */}
        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
              <h3 className="font-extrabold text-white text-base">Terminal 2: Counter 2 (Side Wing)</h3>
            </div>
            <span className="text-xs font-mono text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
              Counter 2
            </span>
          </div>
          <ScannerView overrideCounterId="Counter 2" />
        </div>
      </div>
    </div>
  );
}
