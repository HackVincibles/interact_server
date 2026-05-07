
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const GDSessionSchema = new mongoose.Schema({
  hostId: String,
  roomCode: String,
  status: String,
  sessionState: String,
  participants: Array,
  createdAt: Date
});

const GDSession = mongoose.models.GDSession || mongoose.model('GDSession', GDSessionSchema);

async function checkSessions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("Connected to MongoDB");

    const sessions = await GDSession.find().sort({ createdAt: -1 }).limit(5);
    console.log("Last 5 Sessions:");
    sessions.forEach(s => {
      console.log(`ID: ${s._id} | Code: ${s.roomCode} | Host: ${s.hostId} | Status: ${s.status} | State: ${s.sessionState}`);
      console.log(`Participants: ${s.participants.length}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkSessions();
