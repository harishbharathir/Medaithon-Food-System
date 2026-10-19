import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { playSuccessChime, playDuplicateAlert, playErrorTone, triggerConfetti } from '../utils/audio';

const FoodSystemContext = createContext();

export function FoodSystemProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('scanner'); // 'scanner' | 'dashboard' | 'dual' | 'admin' | 'badges'
  
  // Terminal Identity
  const [counterId, setCounterIdState] = useState(() => localStorage.getItem('medaithon_counter_id') || 'Counter 1');
  const [volunteerName, setVolunteerNameState] = useState(() => localStorage.getItem('medaithon_volunteer_name') || 'Volunteer 1');
  
  // Sound Preference
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('medaithon_sound') !== 'false');

  // Core System Stats & Claims
  const [stats, setStats] = useState({
    session: null,
    total_target: 350,
    claimed_count: 0,
    remaining_count: 350,
    veg_claimed: 0,
    non_veg_claimed: 0,
    counters: {},
    hourly_velocity: [],
    recent_claims: []
  });

  // All Meal Sessions (from Admin)
  const [sessions, setSessions] = useState([]);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('medaithon_sound', next);
      addToast(next ? 'Sound notifications enabled 🔔' : 'Sound notifications muted 🔕', 'info');
      return next;
    });
  }, [addToast]);

  const setCounterId = useCallback((id) => {
    setCounterIdState(id);
    localStorage.setItem('medaithon_counter_id', id);
  }, []);

  const setVolunteerName = useCallback((name) => {
    setVolunteerNameState(name);
    localStorage.setItem('medaithon_volunteer_name', name);
  }, []);

  // Fetch Sessions via REST
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSessions(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, []);

  // Activate a Meal Session
  const activateSession = useCallback(async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/activate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.session) {
          addToast(`Switched active meal to: ${data.session.name}`, 'success');
        }
        if (data.stats) setStats(data.stats);
        refreshSessions();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to activate session:', err);
      return false;
    }
  }, [addToast, refreshSessions]);

  // Fetch Stats via REST
  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Connect WebSockets
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to server:', newSocket.id);
      setIsConnected(true);
      newSocket.emit('register_counter', { counterId, volunteerName });
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    newSocket.on('initial_stats', (data) => {
      if (data?.stats) setStats(data.stats);
      if (data?.sessions) setSessions(data.sessions);
    });

    newSocket.on('stats_update', (data) => {
      if (data?.stats) setStats(data.stats);
      if (data?.sessions) setSessions(data.sessions);
    });

    // Real-time Meal Claimed Broadcast
    newSocket.on('meal_claimed', (data) => {
      const { claim, stats: updatedStats, sessions: updatedSessions } = data;
      if (updatedStats) setStats(updatedStats);
      if (updatedSessions) setSessions(updatedSessions);

      if (claim) {
        if (soundEnabled) playSuccessChime();

        // Milestone celebration
        if (updatedStats && (updatedStats.claimed_count === 50 || updatedStats.claimed_count === 100 || updatedStats.claimed_count % 100 === 0)) {
          triggerConfetti();
        }

        // Notify if another counter claimed a meal
        if (claim.counter_id !== counterId) {
          addToast(`⚡ <strong>${claim.counter_id}</strong> served <strong>${claim.participant_name}</strong>`, 'info', 3000);
        }
      }
    });

    newSocket.on('session_updated', (data) => {
      if (data?.stats) setStats(data.stats);
      if (data?.sessions) setSessions(data.sessions);
      else refreshSessions();
      addToast(`Session updated from Admin: <strong>${data.session?.name || data.activeSession?.name || 'Active Session'}</strong>`, 'info');
    });

    setSocket(newSocket);
    refreshStats();
    refreshSessions();

    return () => {
      newSocket.disconnect();
    };
  }, [counterId, volunteerName, soundEnabled, addToast, refreshStats, refreshSessions]);

  // API Action: Claim Meal
  const claimMeal = useCallback(async ({ participantId, customCounterId, customVolunteerName }) => {
    const cId = customCounterId || counterId;
    const vName = customVolunteerName || volunteerName;

    try {
      const res = await fetch('/api/scans/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participantId.trim(),
          counterId: cId,
          volunteerName: vName
        })
      });

      const data = await res.json();
      if (res.status === 200 && data.success) {
        if (soundEnabled) {
          playSuccessChime();
          triggerConfetti();
        }
        addToast(`✅ Meal claimed for ${data.claim.participant_name}!`, 'success');
        return { success: true, status: 'CLAIMED', claim: data.claim, stats: data.stats };
      } else if (res.status === 409 || data.code === 'ALREADY_CLAIMED') {
        if (soundEnabled) playDuplicateAlert();
        addToast(`⚠️ Already claimed by ${data.claim?.participant_name || 'Participant'}!`, 'error');
        return { success: false, status: 'ALREADY_CLAIMED', claim: data.claim, participant: data.participant };
      } else if (res.status === 404 || data.code === 'NOT_FOUND') {
        if (soundEnabled) playErrorTone();
        addToast(`Participant ID "${participantId}" not found in database`, 'error');
        return { success: false, status: 'NOT_FOUND', participantId };
      } else {
        if (soundEnabled) playErrorTone();
        addToast(data.message || 'Error processing scan', 'error');
        return { success: false, status: 'ERROR', message: data.message };
      }
    } catch (err) {
      if (soundEnabled) playErrorTone();
      addToast('Network connection error', 'error');
      return { success: false, status: 'ERROR', message: err.message };
    }
  }, [counterId, volunteerName, soundEnabled, addToast]);

  // API Action: Manual Walk-in Entry
  const registerManualWalkin = useCallback(async (payload) => {
    try {
      const res = await fetch('/api/participants/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          counterId: payload.counterId || counterId,
          volunteerName: payload.volunteerName || volunteerName
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) playSuccessChime();
        addToast(`✅ ${data.message}`, 'success');
        return { success: true, data };
      } else {
        addToast(data.message || 'Error saving walk-in', 'error');
        return { success: false, message: data.message };
      }
    } catch (err) {
      addToast('Network error during walk-in registration', 'error');
      return { success: false, message: err.message };
    }
  }, [counterId, volunteerName, soundEnabled, addToast]);

  return (
    <FoodSystemContext.Provider
      value={{
        socket,
        isConnected,
        stats,
        refreshStats,
        activeTab,
        setActiveTab,
        counterId,
        setCounterId,
        volunteerName,
        setVolunteerName,
        soundEnabled,
        toggleSound,
        toasts,
        addToast,
        removeToast,
        sessions,
        refreshSessions,
        activateSession,
        claimMeal,
        registerManualWalkin
      }}
    >
      {children}
    </FoodSystemContext.Provider>
  );
}

export function useFoodSystem() {
  const context = useContext(FoodSystemContext);
  if (!context) {
    throw new Error('useFoodSystem must be used within a FoodSystemProvider');
  }
  return context;
}
