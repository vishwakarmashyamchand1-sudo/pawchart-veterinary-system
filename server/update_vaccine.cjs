const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pawchart').then(async () => {
  const db = mongoose.connection.db;
  const res = await db.collection('vaccinemasters').updateOne({ name: 'RHDV1', species: 'Rabbit' }, { $set: { recommendedAge: '1 year' } });
  console.log('Update result:', res);
  mongoose.disconnect();
}).catch(err => console.error(err));
