import React, { useState, useEffect, useRef } from 'react';
import { useFoodSystem } from '../context/FoodSystemContext';
import JsBarcode from 'jsbarcode';
import { Printer, Search, Scan } from 'lucide-react';

function BarcodeSvg({ value }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.8,
          height: 38,
          displayValue: true,
          fontSize: 12,
          font: 'JetBrains Mono',
          background: '#ffffff',
          lineColor: '#000000',
          margin: 0
        });
      } catch (err) {
        console.warn(`JsBarcode error for ${value}:`, err);
      }
    }
  }, [value]);

  return <svg ref={svgRef} className="w-full max-h-[50px]" />;
}

export default function BadgesView() {
  const { setActiveTab, claimMeal } = useFoodSystem();
  const [participants, setParticipants] = useState([]);
  const [filterDiet, setFilterDiet] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/participants?limit=300')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setParticipants(json.data);
        }
      })
      .catch(console.error);
  }, []);

  const filtered = participants.filter((p) => {
    if (filterDiet !== 'all' && (p.diet_pref || '').toLowerCase() !== filterDiet.toLowerCase()) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchTeam = (p.team_name || '').toLowerCase().includes(q);
      const matchCollege = (p.college || '').toLowerCase().includes(q);
      return matchName || matchId || matchTeam || matchCollege;
    }
    return true;
  });

  const handleTestScan = async (id) => {
    await claimMeal({ participantId: id });
    setActiveTab('scanner');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Controls (Hidden in print) */}
      <div className="glass-panel p-4 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search participant name, team or ID..."
              className="glass-input w-full text-xs pl-8"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterDiet('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filterDiet === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({participants.length})
            </button>
            <button
              onClick={() => setFilterDiet('Veg')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filterDiet === 'Veg' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Veg
            </button>
            <button
              onClick={() => setFilterDiet('Non-Veg')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filterDiet === 'Non-Veg' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Non-Veg
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Badges
          </button>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-2 print:gap-8">
        {filtered.map((p) => {
          const isVeg = (p.diet_pref || '').toLowerCase() === 'veg';

          return (
            <div
              key={p.id}
              className="glass-panel p-4 rounded-2xl flex flex-col justify-between border-slate-700/80 hover:border-indigo-500/50 transition print:bg-white print:border-2 print:border-black print:text-black print:shadow-none"
            >
              {/* Top Banner */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 print:border-black pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs print:border print:border-black">
                    M
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 print:text-black uppercase">MEDAITHON 2026</div>
                    <div className="text-xs font-bold text-white print:text-black leading-tight">Participant Badge</div>
                  </div>
                </div>
                <span className={isVeg ? 'badge-veg' : 'badge-nonveg'}>
                  {p.diet_pref?.toUpperCase() || 'VEG'}
                </span>
              </div>

              {/* Participant Details */}
              <div className="my-2">
                <h3 className="text-base font-extrabold text-white print:text-black leading-snug">{p.name}</h3>
                <p className="text-xs text-indigo-400 print:text-black font-semibold">{p.team_name || 'Individual'}</p>
                <p className="text-[11px] text-slate-400 print:text-black">{p.college || 'Engineering Institute'}</p>
              </div>

              {/* Barcode Element */}
              <div className="mt-2 pt-2 border-t border-slate-800 print:border-black flex flex-col items-center justify-center bg-white rounded-xl p-2.5 shadow-inner">
                <BarcodeSvg value={p.id} />
              </div>

              {/* Quick Scan Action (Hidden in Print) */}
              <div className="no-print mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-400">{p.id}</span>
                <button
                  onClick={() => handleTestScan(p.id)}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <Scan className="w-3 h-3" />
                  Test Scan in Terminal →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
