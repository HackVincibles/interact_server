
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function repairData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("Connected to MongoDB");

    const collection = mongoose.connection.collection('gdsessions');
    
    // Find all sessions where recruiterSummary is a string
    const cursor = collection.find({ recruiterSummary: { $type: 'string' } });
    const corrupted = await cursor.toArray();
    
    console.log(`Found ${corrupted.length} corrupted sessions.`);

    for (const session of corrupted) {
      const summaryStr = session.recruiterSummary;
      console.log(`Repairing session: ${session._id}`);
      
      await collection.updateOne(
        { _id: session._id },
        { 
          $set: { 
            recruiterSummary: {
              overview: summaryStr,
              strengths: [],
              weaknesses: [],
              recommendations: []
            }
          } 
        }
      );
    }

    console.log("Repair complete.");
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

repairData();
