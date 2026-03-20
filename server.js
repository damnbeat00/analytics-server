const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const geoip = require('geoip-lite'); // 1. I-import ang geoip

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
  // 2. Kunin ang IP Address ng visitor
  // Ang 'x-forwarded-for' ay para sa mga naka-deploy sa Render/Heroku. 
  // Ang socket.handshake.address naman ay para sa direct connection.
  let ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  
  // Kung localhost ang gamit mo (::1 o 127.0.0.1), walang bansa na lalabas.
  // Para ma-test sa localhost, i-uncomment ang line sa ibaba para mag-kunwari na taga-Philippines ang IP:
  // if (ip === '::1' || ip === '127.0.0.1') ip = '112.198.115.255'; 

  // 3. I-lookup ang Country gamit ang IP
  const geo = geoip.lookup(ip);
  const country = geo ? geo.country : "Unknown"; 

  console.log(`May pumasok na visitor: ${socket.id} mula sa ${country}`);

  socket.on('visitor_joined', (data) => {
    activeVisitors[socket.id] = {
      domain: data.domain,
      path: data.path,
      device: data.device,
      country: country, // 4. Isama ang country sa object
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
  console.log(`✅ Analytics server is running on http://localhost:${PORT}`);
});
