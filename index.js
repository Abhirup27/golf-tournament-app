const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const dotenv = require("dotenv");
const os = require('os');
const QRCode = require('qrcode');
const cookieParser = require("cookie-parser");
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
    console.log(`\nOr, if you wish \x1b[31m\x1b[1mto use OTHER LAPTOP ON THE SAME NETWORK\x1b[0m to access the admin page, \x1b[31m\x1b[1mgo to this link on the other device =>\x1b[0m\x1b[41m\x1b[1m http://${getLocalIp()}:${PORT}/admin\x1b[0m`)

    const qrString = await QRCode.toString(adminurl, {
        type: 'terminal',
        small: true  // Make the QR code smaller in terminal
        });
    console.log('\n👇\x1b[31m\x1b[1mIf you wish to administrate using a mobile device on the same network, scan the QR below.\x1b[0m QR Code for:', adminurl);
    console.log(qrString);


    // Method 2: Generate QR code as data URL
    // const dataUrl = await QRCode.toDataURL(adminurl);
    // console.log('\nData URL for:', adminurl);
    // console.log(dataUrl.substring(0, 50) + '...');  // Showing truncated data URL

    // // Method 3: Generate QR as string of binary data
    // const qrBuffer = await QRCode.toBuffer(adminurl);
    // console.log('\nBuffer length:', qrBuffer.length, 'bytes');

    // //const ngrokUrl = 'http://<your-ngrok-url>';

});

app.use(cookieParser());
app.get('/admin', async (req, res) => {
    if (req.cookies.adminid !=undefined ) {
        res.redirect(303,'/api/admin');
    }
    else
    {
        res.render('login', { isAdmin: true });
    }
});

/**
 * [
 *  c1: {...},
 * c2: {...},
 * ]
 * 
 */