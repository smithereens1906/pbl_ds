const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ensure uploads & tmp folders exist
['uploads','tmp'].forEach(d=> fs.mkdirSync(path.join(__dirname,d),{recursive:true}));

require('./database'); // create tables

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/api', require('./routes/api'));
app.use('/api', require('./routes/auth'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));