const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const dotenv = require("dotenv");
const os = require('os');
const QRCode = require('qrcode');
const { DB_PATH, readJSON, writeJSON } = require('./db');
dotenv.config();
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


function getLocalIp() {

  const interfaces = os.networkInterfaces();

  for (const key in interfaces) {

    for (const details of interfaces[key]) {

      if (details.family === 'IPv4' && !details.internal) {

        return details.address;

      }

    }

  }

  return null;

}

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static("public"));

// Routes
app.use('/api', require('./routes/tournament'));





// Serve the main page
app.get('/', async(req, res) => {
    const tournament = await readJSON(DB_PATH.tournament);

    res.render('index',{tournamentStatus: tournament.status, startDate: tournament.startDate, endDate: tournament.endDate, path:'/'});
    //res.redirect(303, '/api/');
    // res.render('index', {
    //     isAdmin: req.session.isAdmin || false
    // });
});

const PORT = process.env.PORT || 3000;


app.listen(PORT, async () => {
    const adminurl = `http://${getLocalIp()}:${PORT}/admin`;
    console.log('Local IP:', getLocalIp()); 
    console.log(`Server running on port ${PORT}`);
    console.log(`\n\x1b[31m\x1b[1mCtrl + left click\x1b[0m on this => \x1b[41m\x1b[1mhttp://localhost:3000/admin\x1b[0m To go straight to admin login page and set tournament settings and controls.`)
    console.log(`\nOr, if you wish \x1b[31m\x1b[1mto use other LAPTOP\x1b[0m to access the admin page, \x1b[31m\x1b[1mgo to this link on the other device =>\x1b[0m\x1b[41m\x1b[1m http://${getLocalIp()}:${PORT}/admin\x1b[0m`)

    const qrString = await QRCode.toString(adminurl, {
        type: 'terminal',
        small: true  // Make the QR code smaller in terminal
        });
    console.log('\n👇\x1b[31m\x1b[1mIf you wish to administrate using a mobile device, scan the QR below.\x1b[0m QR Code for:', adminurl);
    console.log(qrString);


    // Method 2: Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(adminurl);
    console.log('\nData URL for:', adminurl);
    console.log(dataUrl.substring(0, 50) + '...');  // Showing truncated data URL

    // Method 3: Generate QR as string of binary data
    const qrBuffer = await QRCode.toBuffer(adminurl);
    console.log('\nBuffer length:', qrBuffer.length, 'bytes');

    //const ngrokUrl = 'http://<your-ngrok-url>';
    
        

     // WiFi network details
    const networkDetails = {
        ssid: "ABHISHEK_5G",          // Network name
        password: "reekrishi", // Network password
        encryption: "WPA",              // Encryption type (WPA, WEP, nopass)
        hidden: false                   // Is it a hidden network?
    };

    // Create WiFi connection string in the correct format
    // Format: WIFI:T:<encryption>;S:<ssid>;P:<password>;H:<hidden>;;
    const wifiString = `WIFI:T:${networkDetails.encryption};S:${networkDetails.ssid};P:${networkDetails.password};H:${networkDetails.hidden};;`;

    const wifi_qr = await QRCode.toDataURL(wifiString, {
        width: 400,  // Base size - will scale proportionally
        margin: 1,   // Margin around the QR code
        color: {
            dark: '#ff6242',  // QR code color
            light: '#000000'  // Background color
        }
    });
    const registration_qr = await QRCode.toDataURL(wifiString, {
        width: 400,  // Base size - will scale proportionally
        margin: 1,   // Margin around the QR code
        color: {
            dark: '#ff6242',  // QR code color
            light: '#000000'  // Background color
        }
    });
    try {
        // Generate QR code and display in terminal
        // const qrTerminal = await QRCode.toString(wifiString, {
        //     type: 'terminal'
        // });
        // console.log('Scan this QR code to connect to WiFi:');
        // console.log(qrTerminal);

        // // Generate QR code as PNG file
        // await QRCode.toFile('wifi-connect.png', wifiString, {
        //     width: 300,
        //     margin: 2
        // });
        // console.log('\nQR code has been saved as wifi-connect.png');

    } catch (error) {
        console.error('Error generating WiFi QR code:', error);
    }
});
app.get('/admin', async (req, res) => {
    res.render('login', {isAdmin:true});
});


/**
 * [
 *  c1: {...},
 * c2: {...},
 * ]
 * 
 */