require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('⚠️ WARNING: MONGODB_URI is not set in environment variables! Please add it to your .env file or Render dashboard.');
}

// ----------------- MONGOOSE SCHEMAS ----------------- //

const mealSessionSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  date: { type: String, required: true },
  start_time: { type: String, default: '' },
  end_time: { type: String, default: '' },
  total_target: { type: Number, default: 300 },
  is_active: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

const participantSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  college: { type: String, default: '' },
  team_name: { type: String, default: '' },
  diet_pref: { type: String, default: 'Veg' },
  is_manual_entry: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  created_at: { type: Date, default: Date.now }
});

const mealClaimSchema = new mongoose.Schema({
  claim_id: { type: Number, unique: true },
  session_id: { type: Number, required: true, index: true },
  participant_id: { type: String, required: true, uppercase: true, trim: true, index: true },
  counter_id: { type: String, default: 'Counter 1' },
  volunteer_name: { type: String, default: 'Volunteer' },
  claimed_at: { type: Date, default: Date.now }
});

// Ensure only one claim per participant per meal session
mealClaimSchema.index({ session_id: 1, participant_id: 1 }, { unique: true });

const MealSession = mongoose.model('MealSession', mealSessionSchema);
const Participant = mongoose.model('Participant', participantSchema);
const MealClaim = mongoose.model('MealClaim', mealClaimSchema);

// Helper for auto-incrementing IDs
async function getNextSessionId() {
  const last = await MealSession.findOne().sort({ id: -1 }).select('id').lean();
  return (last && typeof last.id === 'number' ? last.id : 0) + 1;
}

async function getNextClaimId() {
  const last = await MealClaim.findOne().sort({ claim_id: -1 }).select('claim_id').lean();
  return (last && typeof last.claim_id === 'number' ? last.claim_id : 0) + 1;
}

// ----------------- DB INITIALIZATION & SEEDING ----------------- //

async function initDb() {
  if (mongoose.connection.readyState === 1) return;

  try {
    console.log('📡 Connecting to MongoDB Atlas Cloud...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Connected to MongoDB Atlas successfully!');

    // Seed default meal sessions if none exist
    const sessionCount = await MealSession.countDocuments();
    if (sessionCount === 0) {
      const today = new Date().toISOString().split('T')[0];
      const defaultSessions = [
        { id: 1, name: 'Day 1 - Lunch (Medaithon Grand Feast)', date: today, start_time: '12:30', end_time: '15:00', total_target: 350, is_active: 1 },
        { id: 2, name: 'Day 1 - High Tea & Energy Snacks', date: today, start_time: '17:00', end_time: '18:30', total_target: 300, is_active: 0 },
        { id: 3, name: 'Day 1 - Dinner (Hackathon Night)', date: today, start_time: '20:30', end_time: '23:00', total_target: 350, is_active: 0 },
        { id: 4, name: 'Day 2 - Power Breakfast', date: today, start_time: '08:00', end_time: '10:00', total_target: 300, is_active: 0 },
        { id: 5, name: 'Day 2 - Lunch & Valedictory Meal', date: today, start_time: '13:00', end_time: '15:00', total_target: 350, is_active: 0 },
      ];
      await MealSession.insertMany(defaultSessions);
      console.log('🌱 Seeded 5 default meal sessions to MongoDB Atlas');
    }

    // Seed default participants if none exist (all 0 claims / fresh)
    const participantCount = await Participant.countDocuments();
    if (participantCount === 0) {
      const sampleParticipants = [
        { id: 'MED-1001', name: 'Aarav Sharma', email: 'aarav@medtech.org', phone: '+91 9876543210', college: 'IIT Madras', team_name: 'NeuralPulse', diet_pref: 'Veg', is_manual_entry: 0, notes: 'Team Lead' },
        { id: 'MED-1002', name: 'Priya Sundaram', email: 'priya@biocare.in', phone: '+91 9876543211', college: 'PSG Tech', team_name: 'NeuralPulse', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: 'Hardware Lead' },
        { id: 'MED-1003', name: 'Karthik Raja', email: 'karthik@medai.co', phone: '+91 9876543212', college: 'SRM Institute', team_name: 'PulseAI', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1004', name: 'Ananya Deshmukh', email: 'ananya@medaithon.com', phone: '+91 9876543213', college: 'BITS Pilani', team_name: 'PulseAI', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: 'Allergy: Peanuts' },
        { id: 'MED-1005', name: 'Rohan Varma', email: 'rohan.v@gmail.com', phone: '+91 9876543214', college: 'NIT Trichy', team_name: 'CardioVision', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1006', name: 'Sneha Patel', email: 'sneha.p@mit.edu', phone: '+91 9876543215', college: 'MIT Manipal', team_name: 'CardioVision', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1007', name: 'Harish Kumar', email: 'harish@techlead.in', phone: '+91 9876543216', college: 'Anna University', team_name: 'BioSync', diet_pref: 'Veg', is_manual_entry: 0, notes: 'Event Organizer' },
        { id: 'MED-1008', name: 'Divya Krishnan', email: 'divya.k@gmail.com', phone: '+91 9876543217', college: 'Vellore Institute', team_name: 'BioSync', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1009', name: 'Vikram Aditya', email: 'vikram.a@med.in', phone: '+91 9876543218', college: 'Amrita Vishwa', team_name: 'SynapseNet', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1010', name: 'Meera Nair', email: 'meera.n@medicare.io', phone: '+91 9876543219', college: 'Amrita Vishwa', team_name: 'SynapseNet', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1011', name: 'Gautam Menon', email: 'gautam@neuro.org', phone: '+91 9876543220', college: 'SSN College', team_name: 'DeepCare', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1012', name: 'Deepika Iyer', email: 'deepika.i@health.ai', phone: '+91 9876543221', college: 'SSN College', team_name: 'DeepCare', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1013', name: 'Siddharth Rao', email: 'sid.rao@gmail.com', phone: '+91 9876543222', college: 'Kumaraguru Tech', team_name: 'DermaLens', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1014', name: 'Kavya Subramanian', email: 'kavya.s@medai.in', phone: '+91 9876543223', college: 'Kumaraguru Tech', team_name: 'DermaLens', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1015', name: 'Naveen Raj', email: 'naveen.r@outlook.com', phone: '+91 9876543224', college: 'Bannari Amman', team_name: 'SmartIV', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1016', name: 'Shreya Ghosh', email: 'shreya.g@biotech.org', phone: '+91 9876543225', college: 'Jadavpur Univ', team_name: 'SmartIV', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1017', name: 'Aditya Birla', email: 'aditya.b@aiims.edu', phone: '+91 9876543226', college: 'AIIMS Research', team_name: 'EchoBio', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: 'Mentor' },
        { id: 'MED-1018', name: 'Tanvi Joshi', email: 'tanvi.j@medhack.com', phone: '+91 9876543227', college: 'COEP Pune', team_name: 'EchoBio', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1019', name: 'Arjun Reddy', email: 'arjun.r@hyderabad.ac', phone: '+91 9876543228', college: 'IIIT Hyderabad', team_name: 'VoxelMed', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1020', name: 'Pooja Hegde', email: 'pooja.h@techcare.in', phone: '+91 9876543229', college: 'RV College', team_name: 'VoxelMed', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1021', name: 'Manoj Tiwari', email: 'manoj.t@delhitech.in', phone: '+91 9876543230', college: 'DTU Delhi', team_name: 'GlucoSense', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1022', name: 'Ritika Sen', email: 'ritika.s@kolkata.edu', phone: '+91 9876543231', college: 'Calcutta Univ', team_name: 'GlucoSense', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1023', name: 'Abhishek Roy', email: 'abhishek@medaithon.org', phone: '+91 9876543232', college: 'Heritage Tech', team_name: 'OxyTrack', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1024', name: 'Sanjana Chawla', email: 'sanjana@neurotech.com', phone: '+91 9876543233', college: 'Thapar Univ', team_name: 'OxyTrack', diet_pref: 'Veg', is_manual_entry: 0, notes: '' },
        { id: 'MED-1025', name: 'Vigneshwaran M', email: 'vicky@chennaitech.edu', phone: '+91 9876543234', college: 'CIT Chennai', team_name: 'Stethoscope+', diet_pref: 'Non-Veg', is_manual_entry: 0, notes: '' }
      ];
      await Participant.insertMany(sampleParticipants);
      console.log('🌱 Seeded 25 default participants to MongoDB Atlas (All 0 claims / fresh)');
    }
  } catch (err) {
    console.error('❌ MongoDB initialization error:', err);
    throw err;
  }
}

// ----------------- DB QUERY FUNCTIONS ----------------- //

const dbQueries = {
  // Get active session
  async getActiveSession() {
    return await MealSession.findOne({ is_active: 1 }).lean();
  },

  // Get all sessions with claimed counts
  async getAllSessions() {
    const sessions = await MealSession.find().sort({ id: 1 }).lean();
    const sessionIds = sessions.map(s => s.id);
    const claimCounts = await MealClaim.aggregate([
      { $match: { session_id: { $in: sessionIds } } },
      { $group: { _id: '$session_id', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    claimCounts.forEach(c => { countMap[c._id] = c.count; });
    return sessions.map(s => ({
      ...s,
      claimed_count: countMap[s.id] || 0
    }));
  },

  // Set active session
  async setActiveSession(sessionId) {
    const sid = parseInt(sessionId);
    await MealSession.updateMany({}, { $set: { is_active: 0 } });
    await MealSession.updateOne({ id: sid }, { $set: { is_active: 1 } });
    return await this.getActiveSession();
  },

  // Create new session
  async createSession(sessionData) {
    const nextId = await getNextSessionId();
    const newSession = new MealSession({
      id: nextId,
      name: (sessionData.name || '').trim(),
      date: sessionData.date || new Date().toISOString().split('T')[0],
      start_time: sessionData.start_time || '',
      end_time: sessionData.end_time || '',
      total_target: parseInt(sessionData.total_target) || 300,
      is_active: sessionData.is_active ? 1 : 0
    });
    await newSession.save();
    if (sessionData.is_active) {
      await this.setActiveSession(nextId);
    }
    return await MealSession.findOne({ id: nextId }).lean();
  },

  // Update session
  async updateSession(id, data) {
    const sid = parseInt(id);
    const update = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.total_target !== undefined) update.total_target = parseInt(data.total_target);
    if (data.date !== undefined) update.date = data.date;
    if (data.start_time !== undefined) update.start_time = data.start_time;
    if (data.end_time !== undefined) update.end_time = data.end_time;
    await MealSession.updateOne({ id: sid }, { $set: update });
    return await MealSession.findOne({ id: sid }).lean();
  },

  // Delete session
  async deleteSession(id) {
    const sid = parseInt(id);
    await MealClaim.deleteMany({ session_id: sid });
    return await MealSession.deleteOne({ id: sid });
  },

  // Find participant by ID or barcode
  async getParticipantById(id) {
    const cleanId = (id || '').trim().toUpperCase();
    return await Participant.findOne({ id: cleanId }).lean();
  },

  // Check if participant has claimed for this session
  async getClaim(sessionId, participantId) {
    const sid = parseInt(sessionId);
    const pid = (participantId || '').trim().toUpperCase();
    const claim = await MealClaim.findOne({ session_id: sid, participant_id: pid }).lean();
    if (!claim) return null;

    const [participant, session] = await Promise.all([
      Participant.findOne({ id: pid }).lean(),
      MealSession.findOne({ id: sid }).lean()
    ]);

    return {
      ...claim,
      id: claim.claim_id,
      participant_name: participant?.name || '',
      team_name: participant?.team_name || '',
      college: participant?.college || '',
      diet_pref: participant?.diet_pref || 'Veg',
      session_name: session?.name || ''
    };
  },

  // Record meal claim
  async recordClaim(sessionId, participantId, counterId, volunteerName) {
    const sid = parseInt(sessionId);
    const pid = (participantId || '').trim().toUpperCase();
    const claimId = await getNextClaimId();

    const claim = new MealClaim({
      claim_id: claimId,
      session_id: sid,
      participant_id: pid,
      counter_id: counterId,
      volunteer_name: volunteerName || 'Volunteer',
      claimed_at: new Date()
    });
    await claim.save();

    const [participant, session] = await Promise.all([
      Participant.findOne({ id: pid }).lean(),
      MealSession.findOne({ id: sid }).lean()
    ]);

    return {
      claim_id: claimId,
      id: claimId,
      session_id: sid,
      participant_id: pid,
      counter_id: counterId,
      volunteer_name: volunteerName || 'Volunteer',
      claimed_at: claim.claimed_at,
      participant_name: participant?.name || '',
      email: participant?.email || '',
      phone: participant?.phone || '',
      college: participant?.college || '',
      team_name: participant?.team_name || '',
      diet_pref: participant?.diet_pref || 'Veg',
      meal_name: session?.name || ''
    };
  },

  // Add participant
  async addParticipant(participant) {
    const cleanId = (participant.id || '').trim().toUpperCase();
    const newP = new Participant({
      id: cleanId,
      name: (participant.name || '').trim(),
      email: participant.email || '',
      phone: participant.phone || '',
      college: participant.college || '',
      team_name: participant.team_name || '',
      diet_pref: participant.diet_pref || 'Veg',
      is_manual_entry: participant.is_manual_entry ? 1 : 0,
      notes: participant.notes || ''
    });
    await newP.save();
    return await this.getParticipantById(cleanId);
  },

  // Update participant
  async updateParticipant(id, data) {
    const cleanId = (id || '').trim().toUpperCase();
    const update = {};
    if (data.name !== undefined) update.name = data.name.trim();
    if (data.email !== undefined) update.email = data.email;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.college !== undefined) update.college = data.college;
    if (data.team_name !== undefined) update.team_name = data.team_name;
    if (data.diet_pref !== undefined) update.diet_pref = data.diet_pref;
    if (data.notes !== undefined) update.notes = data.notes;
    await Participant.updateOne({ id: cleanId }, { $set: update });
    return await this.getParticipantById(cleanId);
  },

  // Delete participant
  async deleteParticipant(id) {
    const cleanId = (id || '').trim().toUpperCase();
    await MealClaim.deleteMany({ participant_id: cleanId });
    return await Participant.deleteOne({ id: cleanId });
  },

  // Get participants with search and meal count
  async getParticipants(search = '', limit = 200, offset = 0) {
    let query = {};
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query = {
        $or: [
          { id: regex },
          { name: regex },
          { team_name: regex },
          { college: regex }
        ]
      };
    }
    const participants = await Participant.find(query).sort({ created_at: -1 }).skip(offset).limit(limit).lean();
    const pIds = participants.map(p => p.id);
    const mealCounts = await MealClaim.aggregate([
      { $match: { participant_id: { $in: pIds } } },
      { $group: { _id: '$participant_id', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    mealCounts.forEach(m => { countMap[m._id] = m.count; });
    return participants.map(p => ({
      ...p,
      total_meals_taken: countMap[p.id] || 0
    }));
  },

  // Get live statistics for active session
  async getActiveSessionStats() {
    const activeSession = await this.getActiveSession();
    if (!activeSession) {
      return {
        session: null,
        total_target: 0,
        claimed_count: 0,
        remaining_count: 0,
        veg_claimed: 0,
        non_veg_claimed: 0,
        total_participants: await Participant.countDocuments(),
        counters: {},
        hourly_velocity: [],
        recent_claims: []
      };
    }

    const sessionId = activeSession.id;
    const claims = await MealClaim.find({ session_id: sessionId }).sort({ claimed_at: -1 }).lean();
    const totalClaims = claims.length;

    // Get participant details for diet counts and recent claims
    const pIds = [...new Set(claims.map(c => c.participant_id))];
    const participants = await Participant.find({ id: { $in: pIds } }).lean();
    const pMap = {};
    participants.forEach(p => { pMap[p.id] = p; });

    let vegClaimed = 0;
    let nonVegClaimed = 0;
    const counterMap = {};

    claims.forEach(c => {
      // Counter counts
      counterMap[c.counter_id] = (counterMap[c.counter_id] || 0) + 1;

      // Diet breakdown
      const p = pMap[c.participant_id];
      const diet = (p?.diet_pref || '').toLowerCase();
      if (diet === 'veg') vegClaimed++;
      else if (diet.includes('non')) nonVegClaimed++;
    });

    const totalParticipants = await Participant.countDocuments();

    // Recent claims (last 50)
    const recentClaims = claims.slice(0, 50).map(c => {
      const p = pMap[c.participant_id];
      return {
        claim_id: c.claim_id,
        session_id: c.session_id,
        participant_id: c.participant_id,
        counter_id: c.counter_id,
        volunteer_name: c.volunteer_name,
        claimed_at: c.claimed_at,
        participant_name: p?.name || '',
        college: p?.college || '',
        team_name: p?.team_name || '',
        diet_pref: p?.diet_pref || 'Veg',
        meal_name: activeSession.name
      };
    });

    // Hourly velocity
    const hourMap = {};
    claims.forEach(c => {
      const d = new Date(c.claimed_at);
      const hourStr = String(d.getHours()).padStart(2, '0') + ':00';
      hourMap[hourStr] = (hourMap[hourStr] || 0) + 1;
    });
    const hourlyVelocity = Object.keys(hourMap).sort().map(hour => ({
      hour,
      count: hourMap[hour]
    }));

    return {
      session: activeSession,
      total_target: activeSession.total_target,
      claimed_count: totalClaims,
      remaining_count: Math.max(0, activeSession.total_target - totalClaims),
      veg_claimed: vegClaimed,
      non_veg_claimed: nonVegClaimed,
      total_participants: totalParticipants,
      counters: counterMap,
      hourly_velocity: hourlyVelocity,
      recent_claims: recentClaims
    };
  },

  // Full export of claims for CSV report
  async getAllClaimsReport(sessionId = null) {
    const filter = {};
    if (sessionId) filter.session_id = parseInt(sessionId);
    const claims = await MealClaim.find(filter).sort({ claimed_at: -1 }).lean();

    const pIds = [...new Set(claims.map(c => c.participant_id))];
    const sIds = [...new Set(claims.map(c => c.session_id))];

    const [participants, sessions] = await Promise.all([
      Participant.find({ id: { $in: pIds } }).lean(),
      MealSession.find({ id: { $in: sIds } }).lean()
    ]);

    const pMap = {};
    participants.forEach(p => { pMap[p.id] = p; });
    const sMap = {};
    sessions.forEach(s => { sMap[s.id] = s; });

    return claims.map(c => {
      const p = pMap[c.participant_id];
      const s = sMap[c.session_id];
      return {
        claim_id: c.claim_id,
        session_name: s?.name || '',
        session_date: s?.date || '',
        participant_id: c.participant_id,
        participant_name: p?.name || '',
        email: p?.email || '',
        phone: p?.phone || '',
        college: p?.college || '',
        team_name: p?.team_name || '',
        diet_pref: p?.diet_pref || '',
        is_manual_entry: p?.is_manual_entry || 0,
        counter_id: c.counter_id,
        volunteer_name: c.volunteer_name,
        claimed_at: c.claimed_at
      };
    });
  },

  // Reset meal claims
  async resetClaims(sessionId = null) {
    if (sessionId) {
      return await MealClaim.deleteMany({ session_id: parseInt(sessionId) });
    }
    return await MealClaim.deleteMany({});
  }
};

module.exports = {
  mongoose,
  initDb,
  dbQueries,
  MealSession,
  Participant,
  MealClaim
};
