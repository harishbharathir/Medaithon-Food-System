require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb, dbQueries } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve vendor files directly from node_modules for 100% offline reliability
app.use('/vendor/html5-qrcode', express.static(path.join(__dirname, '..', 'node_modules', 'html5-qrcode')));
app.use('/vendor/jsbarcode', express.static(path.join(__dirname, '..', 'node_modules', 'jsbarcode', 'dist')));
app.use('/vendor/chartjs', express.static(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist')));
app.use('/vendor/canvas-confetti', express.static(path.join(__dirname, '..', 'node_modules', 'canvas-confetti', 'dist')));
app.use('/vendor/lucide', express.static(path.join(__dirname, '..', 'node_modules', 'lucide', 'dist', 'umd')));

// Serve compiled React frontend from dist if built, with fallback to public
const distPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, '..', 'public');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
app.use(express.static(publicPath));

// Broadcast helper: send updated stats and all sessions to all connected dashboards and counters
async function broadcastStatsUpdate(event = 'stats_update', extraData = {}) {
  const stats = await dbQueries.getActiveSessionStats();
  const sessions = await dbQueries.getAllSessions();
  io.emit(event, { stats, sessions, ...extraData });
  return stats;
}

// ----------------- API ROUTES ----------------- //

// 1. Get Live Statistics & Active Meal Session
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await dbQueries.getActiveSessionStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Scan & Claim Meal
app.post('/api/scans/claim', async (req, res) => {
  try {
    const { participantId, counterId = 'Counter 1', volunteerName = 'Volunteer', sessionId } = req.body;

    if (!participantId || !participantId.trim()) {
      return res.status(400).json({ success: false, message: 'Participant ID or Barcode is required' });
    }

    const cleanId = participantId.trim().toUpperCase();
    
    // Use specified session if provided, otherwise active session
    let targetSession = null;
    if (sessionId) {
      const allS = await dbQueries.getAllSessions();
      targetSession = allS.find(s => s.id === parseInt(sessionId));
    }
    if (!targetSession) {
      targetSession = await dbQueries.getActiveSession();
    }

    if (!targetSession) {
      return res.status(400).json({
        success: false,
        code: 'NO_ACTIVE_SESSION',
        message: 'No meal session is currently active. Please select or activate a meal session.'
      });
    }

    // Check if participant exists
    const participant = await dbQueries.getParticipantById(cleanId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        participantId: cleanId,
        message: `ID "${cleanId}" not found in database. Use "Manual Walk-in Entry" to register.`
      });
    }

    // Check if already claimed for this meal session
    const existingClaim = await dbQueries.getClaim(targetSession.id, cleanId);
    if (existingClaim) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_CLAIMED',
        claim: existingClaim,
        participant,
        message: `Already claimed by ${participant.name} for ${targetSession.name} at ${existingClaim.counter_id} (${new Date(existingClaim.claimed_at).toLocaleTimeString()})`
      });
    }

    // Process new claim
    const claim = await dbQueries.recordClaim(targetSession.id, cleanId, counterId, volunteerName);
    
    // Broadcast real-time update to all counters and dashboards
    const updatedStats = await dbQueries.getActiveSessionStats();
    const allSessions = await dbQueries.getAllSessions();
    io.emit('meal_claimed', {
      claim,
      stats: updatedStats,
      sessions: allSessions
    });

    res.json({
      success: true,
      code: 'CLAIMED_SUCCESS',
      message: `Meal successfully claimed for ${participant.name}!`,
      claim,
      stats: updatedStats
    });
  } catch (err) {
    console.error('Error in claim scan:', err);
    if (err.code === 11000 || (err.message && err.message.includes('duplicate key'))) {
      const activeSession = await dbQueries.getActiveSession();
      const existingClaim = await dbQueries.getClaim(activeSession ? activeSession.id : 1, req.body.participantId);
      return res.status(409).json({
        success: false,
        code: 'ALREADY_CLAIMED',
        claim: existingClaim,
        message: 'Meal was already claimed seconds ago!'
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Search / Verify Participant (without claiming)
app.get('/api/participants/lookup/:id', async (req, res) => {
  try {
    const cleanId = (req.params.id || '').trim().toUpperCase();
    const participant = await dbQueries.getParticipantById(cleanId);
    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    const activeSession = await dbQueries.getActiveSession();
    let claimStatus = null;
    if (activeSession) {
      claimStatus = await dbQueries.getClaim(activeSession.id, cleanId);
    }

    res.json({
      success: true,
      participant,
      claimed: !!claimStatus,
      claim: claimStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Manual Entry for Walk-ins (Add participant & optional immediate claim)
app.post('/api/participants/manual-entry', async (req, res) => {
  try {
    const {
      id,
      name,
      email = '',
      phone = '',
      college = '',
      team_name = '',
      diet_pref = 'Veg',
      notes = '',
      autoClaim = true,
      counterId = 'Counter 1',
      volunteerName = 'Admin / Volunteer'
    } = req.body;

    if (!id || !id.trim() || !name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Participant ID and Name are required' });
    }

    const cleanId = id.trim().toUpperCase();

    // Check if ID already exists
    let participant = await dbQueries.getParticipantById(cleanId);
    if (participant) {
      // If already exists, update details
      participant = await dbQueries.updateParticipant(cleanId, {
        name, email, phone, college, team_name, diet_pref, notes
      });
    } else {
      participant = await dbQueries.addParticipant({
        id: cleanId,
        name: name.trim(),
        email,
        phone,
        college,
        team_name,
        diet_pref,
        is_manual_entry: 1,
        notes: notes || 'Manual On-Site Entry'
      });
    }

    let claim = null;
    const activeSession = await dbQueries.getActiveSession();

    if (autoClaim && activeSession) {
      // Check if already claimed
      const existingClaim = await dbQueries.getClaim(activeSession.id, cleanId);
      if (!existingClaim) {
        claim = await dbQueries.recordClaim(activeSession.id, cleanId, counterId, volunteerName);
      } else {
        claim = existingClaim;
      }
    }

    // Real-time broadcast
    const stats = await dbQueries.getActiveSessionStats();
    io.emit('participant_added', { participant, claim, stats });
    if (claim) {
      io.emit('meal_claimed', { claim, stats });
    }

    res.json({
      success: true,
      message: claim ? `Participant ${participant.name} registered and meal claimed!` : `Participant ${participant.name} registered successfully!`,
      participant,
      claim,
      stats
    });
  } catch (err) {
    console.error('Error in manual entry:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Participants List & Search
app.get('/api/participants', async (req, res) => {
  try {
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 200;
    const offset = parseInt(req.query.offset) || 0;
    const list = await dbQueries.getParticipants(search, limit, offset);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete / Edit Participant
app.delete('/api/participants/:id', async (req, res) => {
  try {
    await dbQueries.deleteParticipant(req.params.id);
    const stats = await broadcastStatsUpdate('data_changed');
    res.json({ success: true, message: 'Participant removed', stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/participants/:id', async (req, res) => {
  try {
    const updated = await dbQueries.updateParticipant(req.params.id, req.body);
    await broadcastStatsUpdate('data_changed');
    res.json({ success: true, participant: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Meal Sessions Management
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await dbQueries.getAllSessions();
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new session
app.post('/api/sessions', async (req, res) => {
  try {
    const { name, date, start_time, end_time, total_target = 300, is_active = 0 } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Session name is required' });
    }
    const session = await dbQueries.createSession({
      name: name.trim(),
      date: date || new Date().toISOString().split('T')[0],
      start_time: start_time || '',
      end_time: end_time || '',
      total_target: parseInt(total_target) || 300,
      is_active: is_active ? 1 : 0
    });
    const stats = await broadcastStatsUpdate('session_updated');
    res.json({ success: true, session, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Set active session
app.post('/api/sessions/:id/activate', async (req, res) => {
  try {
    const session = await dbQueries.setActiveSession(parseInt(req.params.id));
    const stats = await broadcastStatsUpdate('session_updated', { activeSession: session });
    res.json({ success: true, session, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update session (e.g. update number of meals or meal name)
app.put('/api/sessions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await dbQueries.updateSession(id, req.body);
    const stats = await broadcastStatsUpdate('session_updated', { updatedSession: updated });
    res.json({ success: true, session: updated, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await dbQueries.deleteSession(parseInt(req.params.id));
    const stats = await broadcastStatsUpdate('session_updated');
    res.json({ success: true, message: 'Session deleted', stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset claims for testing / event restart
app.post('/api/admin/reset-claims', async (req, res) => {
  try {
    const { sessionId } = req.body;
    await dbQueries.resetClaims(sessionId ? parseInt(sessionId) : null);
    const stats = await broadcastStatsUpdate('stats_update');
    res.json({ success: true, message: 'Meal claims reset successfully', stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. CSV Report Export
app.get('/api/export/csv', async (req, res) => {
  try {
    const sessionId = req.query.session_id ? parseInt(req.query.session_id) : null;
    const claims = await dbQueries.getAllClaimsReport(sessionId);

    // Build CSV
    const headers = [
      'Claim ID',
      'Meal Session',
      'Session Date',
      'Participant ID',
      'Participant Name',
      'College / Institute',
      'Team Name',
      'Diet Preference',
      'Counter ID',
      'Volunteer Name',
      'Claimed Timestamp',
      'Manual Entry'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = claims.map(c => [
      c.claim_id,
      escapeCsv(c.session_name),
      escapeCsv(c.session_date),
      escapeCsv(c.participant_id),
      escapeCsv(c.participant_name),
      escapeCsv(c.college),
      escapeCsv(c.team_name),
      escapeCsv(c.diet_pref),
      escapeCsv(c.counter_id),
      escapeCsv(c.volunteer_name),
      escapeCsv(c.claimed_at ? new Date(c.claimed_at).toISOString() : ''),
      c.is_manual_entry ? 'YES' : 'NO'
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    const fileName = `medaithon_food_claims_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error generating CSV:', err);
    res.status(500).send('Error generating CSV');
  }
});

// ----------------- SOCKET.IO REAL-TIME CHANNELS ----------------- //

io.on('connection', async (socket) => {
  console.log(`[Socket] New connection established: ${socket.id}`);

  // Send initial real-time stats immediately upon connection
  try {
    const stats = await dbQueries.getActiveSessionStats();
    const sessions = await dbQueries.getAllSessions();
    socket.emit('initial_stats', { stats, sessions });
  } catch (err) {
    console.error('Socket init error:', err);
  }

  // Handle volunteer counter identity registration
  socket.on('register_counter', (data) => {
    socket.counterInfo = data;
    console.log(`[Counter] Socket ${socket.id} registered as:`, data);
  });

  // Client requests immediate refresh
  socket.on('request_refresh', async () => {
    try {
      const stats = await dbQueries.getActiveSessionStats();
      const sessions = await dbQueries.getAllSessions();
      socket.emit('stats_update', { stats, sessions });
    } catch (err) {
      console.error('Socket refresh error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// SPA Fallback for client-side routing (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  next();
});

// Start Server with MongoDB Initialization
async function startServer() {
  try {
    await initDb();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🍽️  MEDAITHON FOOD DISTRIBUTION SYSTEM RUNNING!`);
      console.log(`🚀  Local Access:      http://localhost:${PORT}`);
      console.log(`📊  Live Dashboard:    http://localhost:${PORT}/dashboard.html`);
      console.log(`📷  Volunteer Scanner: http://localhost:${PORT}/scanner.html`);
      console.log(`⚙️  Admin Control:     http://localhost:${PORT}/admin.html`);
      console.log(`🏷️  ID Badges/Barcodes: http://localhost:${PORT}/badges.html`);
      console.log(`☁️  Database:          MongoDB Atlas Cloud`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
