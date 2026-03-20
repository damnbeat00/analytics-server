const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios'); // Ginagamit para kumuha ng location data

const app = express();
const server = http.createServer(app);

// Importante ito para makuha ang totoong IP address kung naka-host sa Render
app.set('trust proxy', true);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

let activeVisitors = {};

io.on('connection', (socket) => {
  console.log('May pumasok na visitor:', socket.id);

  socket.on('visitor_joined', async (data) => {
    // 1. Kunin ang IP address ng client
    let clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    
    // Linisin ang IP address (minsan kasi comma-separated ito sa servers)
    if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }

    // Default value kung sakaling pumalya ang pagkuha ng location
    let countryName = 'Unknown';

    try {
      // 2. Kunin ang bansa gamit ang IP address (Free API)
      // Note: Hindi ito gagana kung '::1' (localhost) ang IP. 
      if (clientIp !== '::1' && clientIp !== '127.0.0.1') {
          const response = await axios.get(`http://ip-api.com/json/${clientIp}`);
          if (response.data && response.data.country) {
              countryName = response.data.country;
          }
      } else {
          countryName = 'Localhost (Testing)';
      }
    } catch (error) {
      console.error('Error fetching location:', error.message);
    }

    // 3. I-save ang data kasama ang bansa
    activeVisitors[socket.id] = {
      domain: data.domain,
      path: data.path,
      device: data.device,
      country: countryName, // Dito natin ilalagay ang nakuhang bansa
      timestamp: Date.now()
    };
    
    io.emit('update_dashboard', Object.values(activeVisitors));
  });

  socket.on('disconnect', () => {
    console.log('Umalis ang visitor:', socket.id);
    delete activeVisitors[socket.id];
    io.emit('update_dashboard', Object.values(activeVisitors));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Analytics server is running on port ${PORT}`);
});
