
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const GDSessionSchema = new mongoose.Schema({
  hostId: String,
  roomId: String,
  roomCode: String,
  status: String,
  sessionState: String,
  participants: Array,
  createdAt: Date
});

const GDSession = mongoose.models.GDSession || mongoose.model('GDSession', GDSessionSchema);

async function checkRoom() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    const session = await GDSession.findOne({ roomId: "ew4f-j21u-gsw2" });
    if (session) {
      console.log(`FOUND SESSION: ${session._id}`);
      console.log(`Host: ${session.hostId}`);
    } else {
      console.log("NOT FOUND");
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkRoom();
