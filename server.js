const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const geoip = require('geoip-lite');

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

let activeVisitors = {};

io.on('connection', (socket) => {
  // 1. KUNIN ANG IP MULA SA RENDER
  let rawIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  // 2. LINISIN ANG IP (Kunin lang ang pinaka-una kung maraming IP ang ipinasa ng Render)
  let ip = rawIp ? rawIp.split(',')[0].trim() : '';

  // 3. HANAPIN ANG BANSA GAMIT ANG IP
  const geo = geoip.lookup(ip);
  const country = geo ? geo.country : "Unknown";

  // I-print sa server console para makita natin mamaya kung gumagana
  console.log(`[LOG] May pumasok! IP: ${ip} | Bansa: ${country}`);

  socket.on('visitor_joined', (data) => {
    activeVisitors[socket.id] = {
      domain: data.domain,
      path: data.path,
      device: data.device,
      country: country, // Ipinapasa na natin ang bansa papunta sa dashboard
      timestamp: Date.now()
    };
    io.emit('update_dashboard', Object.values(activeVisitors));
  });

  socket.on('disconnect', () => {
    delete activeVisitors[socket.id];
    io.emit('update_dashboard', Object.values(activeVisitors));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Analytics server is running on port ${PORT}`);
});
