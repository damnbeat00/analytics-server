const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios'); 

const app = express();
const server = http.createServer(app);

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
    let clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    
    if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }

    let countryName = 'Unknown';
    let cityName = 'Unknown'; // Dito natin isesave ang City

    try {
      if (clientIp !== '::1' && clientIp !== '127.0.0.1') {
          const response = await axios.get(`http://ip-api.com/json/${clientIp}`);
          if (response.data && response.data.country) {
              countryName = response.data.country;
              cityName = response.data.city || 'Unknown City'; // Kinukuha ang city
          }
      } else {
          countryName = 'Localhost';
          cityName = 'Local';
      }
    } catch (error) {
      console.error('Error fetching location:', error.message);
    }

    activeVisitors[socket.id] = {
      domain: data.domain,
      path: data.path,
      device: data.device,
      country: countryName,
      city: cityName, // Ipapasa natin yung city sa dashboard
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
