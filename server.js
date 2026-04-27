const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const geoip = require('geoip-lite'); 

const app = express();
const server = http.createServer(app);

app.set('trust proxy', true);

// Naka-set na sa * ang CORS para payagan ang lahat ng connection
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

  // NAAYOS NA: Pinalitan ng 'visitor_data' para tumugma sa ipinapadala ng website mo
  socket.on('visitor_data', (data) => {
    let clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    
    if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }

    let countryName = 'Unknown';
    let cityName = 'Unknown City'; 

    // Gamitin ang geoip-lite para hanapin ang location ng IP
    if (clientIp !== '::1' && clientIp !== '127.0.0.1') {
        const geo = geoip.lookup(clientIp);
        if (geo) {
            countryName = geo.country || 'Unknown';
            cityName = geo.city || 'Unknown City';
        }
    } else {
        countryName = 'Localhost';
        cityName = 'Local';
    }

    // Isesave natin sila as "online" kasama ang browser at referrer
    activeVisitors[socket.id] = {
      id: socket.id, // Important para sa React/Dashboard list keys
      domain: data.domain,
      path: data.path,
      device: data.device,
      browser: data.browser || 'Unknown',
      referrer: data.referrer || 'Direct',
      country: countryName,
      city: cityName,
      timestamp: Date.now(),
      status: 'online'
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
