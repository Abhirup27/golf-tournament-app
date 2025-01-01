const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const dotenv = require("dotenv");
dotenv.config();
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static("public"));
// Routes
app.use('/api', require('./routes/tournament'));

// Serve the main page
app.get('/', (req, res) => {

    res.render('index');
    //res.redirect(303, '/api/');
    // res.render('index', {
    //     isAdmin: req.session.isAdmin || false
    // });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
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