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
    let cityName = 'Unknown'; 

    try {
      if (clientIp !== '::1' && clientIp !== '127.0.0.1') {
          const response = await axios.get(`http://ip-api.com/json/${clientIp}`);
          if (response.data && response.data.country) {
              countryName = response.data.country;
              cityName = response.data.city || 'Unknown City';
          }
      } else {
          countryName = 'Localhost';
          cityName = 'Local';
      }
    } catch (error) {
      console.error('Error fetching location:', error.message);
    }

    // Isesave natin sila as "online"
    activeVisitors[socket.id] = {
      domain: data.domain,
      path: data.path,
      device: data.device,
      country: countryName,
      city: cityName,
      timestamp: Date.now(),
      status: 'online' // <-- Bagong dinagdag
    };
    
    io.emit('update_dashboard', Object.values(activeVisitors));
  });

  socket.on('disconnect', () => {
    console.log('Umalis ang visitor:', socket.id);
    
    // Imbes na i-delete agad, gagawin muna nating "offline"
    if (activeVisitors[socket.id]) {
        activeVisitors[socket.id].status = 'offline';
        io.emit('update_dashboard', Object.values(activeVisitors));

        // Timer: Hintay ng 5 minutes (300,000 ms) bago i-delete
        setTimeout(() => {
            if (activeVisitors[socket.id]) {
                delete activeVisitors[socket.id];
                io.emit('update_dashboard', Object.values(activeVisitors));
            }
        }, 5 * 60 * 1000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Analytics server is running on port ${PORT}`);
});
