const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const geoip = require('geoip-lite'); // <-- Gagamitin na natin ito imbes na axios

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

// Function para ma-convert ang "PH" to "Philippines"
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

io.on('connection', (socket) => {
  console.log('May pumasok na visitor:', socket.id);

  socket.on('visitor_joined', (data) => { // Hindi na kailangan ng async
    let clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    
    // Kunin ang tunay na IP kung dumaan sa proxy/load balancer
    if (clientIp.includes(',')) {
        clientIp = clientIp.split(',')[0].trim();
    }

    let countryName = 'Unknown';
    let cityName = 'Unknown City'; 

    if (clientIp !== '::1' && clientIp !== '127.0.0.1') {
        // Gagamitin ang geoip-lite (walang rate limit, mabilis)
        const geo = geoip.lookup(clientIp);
        
        if (geo) {
            cityName = geo.city || 'Unknown City';
            try {
                // I-convert ang 2-letter code to Full Country Name
                countryName = geo.country ? regionNames.of(geo.country) : 'Unknown';
            } catch (e) {
                countryName = geo.country || 'Unknown';
            }
        }
    } else {
        countryName = 'Localhost';
        cityName = 'Local';
    }

    // Isesave natin sila as "online"
    activeVisitors[socket.id] = {
      domain: data.domain,
      path: data.path,
      device: data.device,
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
