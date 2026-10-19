import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFoodSystem } from '../context/FoodSystemContext';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Scan,
  Camera,
  CameraOff,
  Barcode,
  Search,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  History,
  UserPlus,
  Utensils,
  Clock,
  Zap
} from 'lucide-react';

export default function ScannerView() {
  const {
    stats,
    sessions,
    activateSession,
    counterId,
    setCounterId,
    volunteerName,
    setVolunteerName,
    claimMeal,
    registerManualWalkin
  } = useFoodSystem();

  const currentCounter = counterId;

  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { status: 'CLAIMED' | 'ALREADY_CLAIMED' | 'NOT_FOUND', claim, participant, message }
  const [counterLog, setCounterLog] = useState([]);
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinPrefillId, setWalkinPrefillId] = useState('');

  // Walk-in Form State
  const [walkinForm, setWalkinForm] = useState({
    id: '',
    name: '',
    college: '',
    team_name: '',
    diet_pref: 'Veg',
    autoClaim: true
  });

  const html5QrCodeRef = useRef(null);
  const scannerContainerId = `qr-reader-${currentCounter.replace(/\s+/g, '-')}`;
  const inputRef = useRef(null);
  const lastScannedRef = useRef({ code: '', time: 0 });
  const autoDetectTimerRef = useRef(null);
  const lastKeyTimeRef = useRef(0);
  const isProcessingRef = useRef(false);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup auto-detect timer on unmount
  useEffect(() => {
    return () => {
      if (autoDetectTimerRef.current) {
        clearTimeout(autoDetectTimerRef.current);
      }
    };
  }, []);

  // Process Scan
  const handleProcessBarcode = useCallback(
    async (code) => {
      const clean = (code || '').trim().toUpperCase();
      if (!clean) return;

      if (autoDetectTimerRef.current) {
        clearTimeout(autoDetectTimerRef.current);
        autoDetectTimerRef.current = null;
      }

      // Debounce duplicate immediate physical scans
      const now = Date.now();
      if (clean === lastScannedRef.current.code && now - lastScannedRef.current.time < 2500) {
        setBarcodeInput('');
        return;
      }
      lastScannedRef.current = { code: clean, time: now };

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        const res = await claimMeal({
          participantId: clean,
          customCounterId: currentCounter,
          customVolunteerName: volunteerName
        });

        setScanResult(res);

        if (res.status === 'CLAIMED' && res.claim) {
          setCounterLog((prev) => [res.claim, ...prev]);
        } else if (res.status === 'NOT_FOUND') {
          setWalkinPrefillId(clean);
        }
      } finally {
        isProcessingRef.current = false;
        setBarcodeInput('');
        inputRef.current?.focus();
      }
    },
    [claimMeal, currentCounter, volunteerName]
  );

  // Auto-detect input handlers for barcode gun and typing
  const handleInputChange = (e) => {
    const val = e.target.value;
    setBarcodeInput(val);

    if (autoDetectTimerRef.current) {
      clearTimeout(autoDetectTimerRef.current);
      autoDetectTimerRef.current = null;
    }

    const clean = val.trim().toUpperCase();
    if (!clean || clean.length < 3) {
      return;
    }

    // Determine delay:
    // Barcode scanner guns type characters rapidly (< 65ms per character) -> trigger quickly (120ms)
    // Manual typing -> wait 400ms for user to finish input
    const now = Date.now();
    const isRapid = now - lastKeyTimeRef.current < 65;
    const delay = isRapid ? 120 : 400;

    autoDetectTimerRef.current = setTimeout(() => {
      handleProcessBarcode(clean);
    }, delay);
  };

  const handleKeyDown = (e) => {
    lastKeyTimeRef.current = Date.now();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (autoDetectTimerRef.current) {
        clearTimeout(autoDetectTimerRef.current);
        autoDetectTimerRef.current = null;
      }
      handleProcessBarcode(barcodeInput);
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData?.getData('text');
    if (pasted && pasted.trim().length >= 3) {
      e.preventDefault();
      const clean = pasted.trim().toUpperCase();
      setBarcodeInput(clean);
      if (autoDetectTimerRef.current) {
        clearTimeout(autoDetectTimerRef.current);
      }
      autoDetectTimerRef.current = setTimeout(() => {
        handleProcessBarcode(clean);
      }, 100);
    }
  };

  // Camera Scanner Toggle
  const toggleCamera = async () => {
    if (isScanning) {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          console.warn('Error stopping camera:', e);
        }
      }
      setIsScanning(false);
    } else {
      try {
        if (!html5QrCodeRef.current) {
          html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
        }
        await html5QrCodeRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 250, height: 180 },
            formatsToSupport: [
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.QR_CODE
            ]
          },
          (decodedText) => {
            handleProcessBarcode(decodedText);
          },
          () => {}
        );
        setIsScanning(true);
      } catch (err) {
        console.error('Failed to start camera:', err);
        alert('Could not start camera. Please check camera permissions or use barcode input.');
        setIsScanning(false);
      }
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [isScanning]);

  // Handle Walk-in Submission
  const handleWalkinSubmit = async (e) => {
    e.preventDefault();
    const res = await registerManualWalkin({
      ...walkinForm,
      counterId: currentCounter,
      volunteerName
    });

    if (res.success) {
      setShowWalkinModal(false);
      if (res.data?.claim) {
        setScanResult({ status: 'CLAIMED', claim: res.data.claim });
        setCounterLog((prev) => [res.data.claim, ...prev]);
      }
      setWalkinForm({
        id: '',
        name: '',
        college: '',
        team_name: '',
        diet_pref: 'Veg',
        autoClaim: true
      });
    }
  };

  const currentCounterServed = stats.counters[currentCounter] || 0;
  const pct = stats.total_target > 0 ? Math.min(100, Math.round((stats.claimed_count / stats.total_target) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Counter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Counter Info */}
        <div className="glass-panel p-4 flex flex-col justify-between">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Counter Configuration
          </label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select
              value={counterId}
              onChange={(e) => setCounterId(e.target.value)}
              className="glass-input w-full text-xs font-semibold text-indigo-300"
            >
              <option value="Counter 1">Counter 1</option>
              <option value="Counter 2">Counter 2</option>
              <option value="Counter 3">Counter 3</option>
              <option value="Counter 4">Counter 4</option>
            </select>
            <input
              type="text"
              value={volunteerName}
              onChange={(e) => setVolunteerName(e.target.value)}
              placeholder="Volunteer"
              className="glass-input w-full text-xs"
            />
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Served at this counter:</span>
            <span className="font-bold text-indigo-400 font-mono">{currentCounterServed} meals</span>
          </div>
        </div>

        {/* Meal Type (From Admin) */}
        <div className="glass-panel p-4 flex flex-col justify-between border-indigo-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Meal Type (From Admin)
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {stats.session?.start_time || '12:30'} - {stats.session?.end_time || '15:00'}
            </span>
          </div>
          <div className="my-1">
            <select
              value={stats.session?.id || ''}
              onChange={(e) => activateSession(e.target.value)}
              className="glass-input w-full text-xs font-bold text-white bg-slate-900 border-indigo-500/40 cursor-pointer py-1.5"
            >
              {sessions.length === 0 ? (
                <option value="">{stats.session?.name || 'Default Session'}</option>
              ) : (
                sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.start_time ? `(${s.start_time}-${s.end_time || ''})` : ''} {s.is_active ? '⭐ [Active]' : ''}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-1.5">
            <span>Target: <strong className="text-white font-mono">{stats.total_target}</strong></span>
            <span className="text-emerald-400 font-semibold uppercase">{stats.session?.is_active ? 'Active' : 'Selected'}</span>
          </div>
        </div>

        {/* Real-time Shared Totals */}
        <div className="glass-panel p-4 flex flex-col justify-between bg-gradient-to-br from-indigo-950/40 to-slate-900 border-indigo-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Live Shared Count</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
              {pct}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 my-1">
            <div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {stats.claimed_count.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 uppercase">Total Claimed</div>
            </div>
            <div>
              <div className="text-2xl font-black text-cyan-400 font-mono">
                {stats.remaining_count.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 uppercase">Meals Left</div>
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Viewfinder & Input (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scan className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Barcode / QR Scanner</h3>
              </div>
              <button
                onClick={toggleCamera}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  isScanning
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isScanning ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                <span>{isScanning ? 'Stop Camera' : 'Start Camera'}</span>
              </button>
            </div>

            {/* Viewfinder */}
            <div className="relative rounded-xl overflow-hidden bg-black/90 border border-slate-800 min-h-[220px] max-h-[320px] flex items-center justify-center">
              <div id={scannerContainerId} className="w-full h-full" />
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400">
                    <CameraOff className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">Camera scanner is off</p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Click "Start Camera" to scan via webcam or use handheld USB scanner / manual typing below.
                  </p>
                </div>
              )}
            </div>

            {/* USB Gun / Manual Barcode Input */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Barcode className="w-4 h-4 text-slate-400" />
                  Scan Barcode Gun / Type Participant ID
                </span>
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Auto-Detect Active
                </span>
              </label>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Scan barcode or type ID (auto-claims instantly)..."
                  className="glass-input w-full font-mono text-base tracking-wider uppercase pl-10 pr-36"
                  autoComplete="off"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 pointer-events-none shadow-sm">
                  <Zap className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                  Auto-Detect
                </div>
              </div>

              {/* Sample Test Pills */}
              <div className="mt-3 flex items-center gap-2 overflow-x-auto py-1">
                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Instant Auto-Claim:</span>
                {['MED-1001', 'MED-1002', 'MED-1003', 'MED-1004', 'MED-9999'].map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleProcessBarcode(id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 whitespace-nowrap transition"
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Feedback Result Card & Local Scan Log (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-5 min-h-[300px] flex flex-col justify-center items-center text-center">
            {/* IDLE STATE */}
            {!scanResult && (
              <div className="flex flex-col items-center justify-center p-6 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Scan className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Ready to Scan</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Point camera at ID card barcode, or trigger handheld USB scanner.
                  </p>
                </div>
              </div>
            )}

            {/* SUCCESS STATE */}
            {scanResult?.status === 'CLAIMED' && (
              <div className="w-full flex flex-col items-center animate-slide-down">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mb-2.5 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                  Meal Claimed Successfully
                </span>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {scanResult.claim.participant_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {scanResult.claim.participant_id}
                  </span>
                  <span className={scanResult.claim.diet_pref?.toLowerCase() === 'veg' ? 'badge-veg' : 'badge-nonveg'}>
                    {scanResult.claim.diet_pref?.toUpperCase() || 'VEG'}
                  </span>
                </div>

                <div className="w-full mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Team:</span>
                    <span className="font-semibold text-slate-200">{scanResult.claim.team_name || 'Individual'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">College:</span>
                    <span className="font-semibold text-slate-200 truncate max-w-[180px]">
                      {scanResult.claim.college || 'Medaithon'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Session:</span>
                    <span className="font-semibold text-indigo-300 truncate max-w-[180px]">
                      {scanResult.claim.meal_name}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5 text-[11px] text-slate-400 font-mono">
                    <span>Processed at:</span>
                    <span>{scanResult.claim.counter_id} • {new Date(scanResult.claim.claimed_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                <p className="text-xs font-semibold text-emerald-400 mt-3 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5" />
                  Please issue food tray!
                </p>
              </div>
            )}

            {/* DUPLICATE STATE */}
            {scanResult?.status === 'ALREADY_CLAIMED' && (
              <div className="w-full flex flex-col items-center animate-slide-down">
                <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400 mb-2.5 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                  <AlertTriangle className="w-9 h-9" />
                </div>
                <span className="px-3 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                  ALREADY CLAIMED!
                </span>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {scanResult.claim?.participant_name || scanResult.participant?.name || 'Participant'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {scanResult.claim?.participant_id || scanResult.participant?.id}
                  </span>
                </div>

                <div className="w-full mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-left space-y-1 text-xs text-rose-200">
                  <p className="font-semibold text-rose-300">Duplicate Claim Blocked</p>
                  <p className="text-slate-300 text-[11px]">
                    This participant has already collected food for this active session.
                  </p>
                  {scanResult.claim && (
                    <div className="border-t border-rose-800/40 pt-1 text-[11px] flex justify-between font-mono text-slate-400">
                      <span>Time: {new Date(scanResult.claim.claimed_at).toLocaleTimeString()}</span>
                      <span className="font-bold text-rose-300">{scanResult.claim.counter_id}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* NOT FOUND STATE */}
            {scanResult?.status === 'NOT_FOUND' && (
              <div className="w-full flex flex-col items-center animate-slide-down">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 mb-2.5">
                  <HelpCircle className="w-9 h-9" />
                </div>
                <span className="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                  Participant Not Found
                </span>
                <p className="text-sm font-semibold text-slate-200 mt-1">
                  ID "{scanResult.participantId}" is not in DB.
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Register this participant on-site as a manual walk-in?
                </p>

                <button
                  onClick={() => {
                    setWalkinForm((prev) => ({ ...prev, id: walkinPrefillId }));
                    setShowWalkinModal(true);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Manual Walk-in & Claim Meal
                </button>
              </div>
            )}
          </div>

          {/* Local Scan Log for this Counter */}
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                {currentCounter} Scan Feed
              </h4>
              <span className="text-[11px] font-mono text-slate-500">{counterLog.length} processed</span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {counterLog.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No scans processed at this counter yet.</p>
              ) : (
                counterLog.map((c, i) => (
                  <div
                    key={c.claim_id || i}
                    className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs animate-slide-down"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {c.participant_name} <span className="text-slate-400 font-mono">({c.participant_id})</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {c.team_name || 'Medaithon'} • {new Date(c.claimed_at).toLocaleTimeString()}
                      </div>
                    </div>
                    <span className={c.diet_pref?.toLowerCase() === 'veg' ? 'badge-veg' : 'badge-nonveg'}>
                      {c.diet_pref?.toUpperCase() || 'VEG'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Walkin Modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-elevated max-w-md w-full p-6 animate-slide-down">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                Manual Walk-in Registration
              </h3>
              <button
                onClick={() => setShowWalkinModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWalkinSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ID / Barcode *</label>
                <input
                  type="text"
                  required
                  value={walkinForm.id}
                  onChange={(e) => setWalkinForm({ ...walkinForm, id: e.target.value.toUpperCase() })}
                  className="glass-input w-full font-mono text-xs uppercase"
                  placeholder="e.g. MED-WALK01"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={walkinForm.name}
                  onChange={(e) => setWalkinForm({ ...walkinForm, name: e.target.value })}
                  className="glass-input w-full text-xs"
                  placeholder="Participant Name"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">College</label>
                  <input
                    type="text"
                    value={walkinForm.college}
                    onChange={(e) => setWalkinForm({ ...walkinForm, college: e.target.value })}
                    className="glass-input w-full text-xs"
                    placeholder="College"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Team</label>
                  <input
                    type="text"
                    value={walkinForm.team_name}
                    onChange={(e) => setWalkinForm({ ...walkinForm, team_name: e.target.value })}
                    className="glass-input w-full text-xs"
                    placeholder="Team Name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Diet Preference</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="reactWalkinDiet"
                      value="Veg"
                      checked={walkinForm.diet_pref === 'Veg'}
                      onChange={() => setWalkinForm({ ...walkinForm, diet_pref: 'Veg' })}
                      className="accent-emerald-500"
                    />
                    <span className="text-xs font-bold text-emerald-400">VEG</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="reactWalkinDiet"
                      value="Non-Veg"
                      checked={walkinForm.diet_pref === 'Non-Veg'}
                      onChange={() => setWalkinForm({ ...walkinForm, diet_pref: 'Non-Veg' })}
                      className="accent-rose-500"
                    />
                    <span className="text-xs font-bold text-rose-400">NON-VEG</span>
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={walkinForm.autoClaim}
                    onChange={(e) => setWalkinForm({ ...walkinForm, autoClaim: e.target.checked })}
                    className="accent-indigo-500 w-4 h-4 rounded"
                  />
                  <span>Claim meal for active session immediately</span>
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowWalkinModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex-1"
                >
                  Save & Serve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
