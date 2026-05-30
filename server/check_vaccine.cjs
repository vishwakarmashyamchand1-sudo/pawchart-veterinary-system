const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pawchart').then(async () => {
  const db = mongoose.connection.db;
  const docs = await db.collection('vaccinemasters').find({ species: 'Rabbit' }).toArray();
  console.log(docs);
  mongoose.disconnect();
}).catch(err => console.error(err));
