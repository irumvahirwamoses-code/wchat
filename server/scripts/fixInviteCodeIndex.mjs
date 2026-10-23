import mongoose from 'mongoose';
import Chat from '../models/Chat.js';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chattinga';

await mongoose.connect(uri);

// 1. Drop the stale index (built back when inviteCode defaulted to null).
try {
  await Chat.collection.dropIndex('inviteCode_1');
  console.log('dropped stale inviteCode_1 index');
} catch (error) {
  console.log('inviteCode_1 index not present:', error.message);
}

// 2. Remove the nulls so the field is simply absent on chats without a code.
const cleaned = await Chat.updateMany({ inviteCode: null }, { $unset: { inviteCode: '' } });
console.log('cleaned chats:', cleaned.modifiedCount);

// 3. Rebuild indexes from the current schema.
await Chat.syncIndexes();
console.log(
  'indexes now:',
  (await Chat.collection.indexes()).map((index) => index.name).join(', ')
);

await mongoose.disconnect();
