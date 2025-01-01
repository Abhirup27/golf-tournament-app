const express = require('express');

const router = express.Router();

const { v4: uuidv4 } = require('uuid');
const { DB_PATH, readJSON, writeJSON } = require('../db');
const session = require("express-session");
const cookieParser = require("cookie-parser");
// Check if user is admin

const dotenv = require("dotenv");
dotenv.config();
const crypto = require('crypto');
const { write, read } = require('fs');
var adminid;

const GolfScore = {
    ALBATROSS: -3,
    EAGLE: -2,
    BIRDIE: -1,
    PAR: 0,
    BOGEY: 1,
    DOUBLE_BOGEY: 2,
    TRIPLE_BOGEY: 3,
    HOLE_IN_ONE: 1,
    CONDOR: -4
};

// Create a mapping from score number to description
const scoreToName = {
    [-4]: "Condor",
    [-3]: "Albatross",
    [-2]: "Eagle",
    [-1]: "Birdie",
    [0]: "Par",
    [1]: "Bogey",
    [2]: "Double Bogey",
    [3]: "Triple Bogey"
};
let existingTimer;
function getScoreName(actualStrokes, parForHole) {
    // Handle null, undefined, or invalid inputs
    if (!actualStrokes || !parForHole || isNaN(actualStrokes) || isNaN(parForHole)) {
        return null;
    }

    // Special case for hole in one
    if (actualStrokes === 1) {
        return "Hole in One";
    }

    const scoreRelativeToPar = actualStrokes - parForHole;
    return scoreToName[scoreRelativeToPar] ||
        (scoreRelativeToPar > 3 ? `${scoreRelativeToPar} Over Par` : `${Math.abs(scoreRelativeToPar)} Under Par`);
}

async function startTournament()  // sets the status to ongoing
{
    const tournament = await readJSON(DB_PATH.tournament);
    tournament.status = "ongoing";
    await writeJSON(DB_PATH.tournament, tournament);
    const players = await readJSON(DB_PATH.players);
    players.forEach(player => {
        player.strokes = []; player.scores = []; player.score = "";
     });
    await writeJSON(DB_PATH.players, players);
}
async function stopTournament()  
{
    const tournament = await readJSON(DB_PATH.tournament);
    tournament.status = "finished";
    await writeJSON(DB_PATH.tournament, tournament);
}
async function pauseTournament()  
{
    const tournament = await readJSON(DB_PATH.tournament);
    tournament.status = "paused";
    await writeJSON(DB_PATH.tournament, tournament);
}

// const isAdmin = async (req, res, next) => {
//     const players = await readJSON(DB_PATH.players);
//     const player = players.find(p => p.id === req.session.playerId);
//     if (!player || !player.isAdmin) {
//         return res.status(403).json({ error: 'Unauthorized' });
//     }
//     next();
// };

const getCups = async () => {
    const tournament = await readJSON(DB_PATH.tournament);
    return tournament.cups;
};
const getCupLocks = async() => {
     const tournament = await readJSON(DB_PATH.tournament);
     return tournament.cupLocks;
}
const isOngoing = async () => {
    const tournament = await readJSON(DB_PATH.tournament);
    
    if (tournament.status == "ongoing" || tournament.status == "paused")
    {
        return true;
    }
    else
    {
        return false;
        
    }
};
const isPaused = async () => {
    const tournament = await readJSON(DB_PATH.tournament);
    
    if (tournament.status == "paused")
    {
        return true;
    }
    else
    {
        return false;
        
    }
};
const isIdle = async () => {
    const tournament = await readJSON(DB_PATH.tournament);
    
    if (tournament.status == "idle")
    {
        return true;
    }
    else
    {
        return false;
        
    }
};
const getPar = async () => {
    const tournament = await readJSON(DB_PATH.tournament);
    return tournament.par;
}

const getPars= async () => {  // DO NOT USE THIS, TOURNAMENT AND PARS ARE REFERENCE TYPES AND THIS POINTER GETS DELETED ONCE RETURNS
    const tournament = await readJSON(DB_PATH.tournament);
    return tournament.pars;
}



const calcTotalScore = async () =>
{
    const par = await getPar();
    const players = await readJSON(DB_PATH.players);


    players.forEach(player => {
        var totalStrokes = 0;
        for (const strokes of player.strokes) {
            totalStrokes += strokes;
        }
        player.score = getScoreName(totalStrokes, par);

    });

    await writeJSON(DB_PATH.players, players);
}
const calcScore = async (idx) => {
    try {
        const  players = await readJSON(DB_PATH.players)

        const tournament = await readJSON(DB_PATH.tournament);
        console.log(tournament.pars)
        if (!tournament.pars || !tournament.pars[idx]) {
            console.error(`No par value found for hole ${idx}`);
            return;
        }

        const par = tournament.pars[idx];

        for (const player of players) {
            // Initialize scores array if it doesn't exist
            if (!Array.isArray(player.scores)) {
                player.scores = new Array(tournament.cups).fill(null);
            }

            // Only calculate score if there's a valid stroke value
            if (player.strokes && 
                Array.isArray(player.strokes) && 
                typeof player.strokes[idx] === 'number' && 
                player.strokes[idx] !== 0) {
                
                player.scores[idx] = getScoreName(player.strokes[idx], par);
            }
        }
        
        await writeJSON(DB_PATH.players, players);
    } catch (error) {
        console.error('Error in calcScore:', error);
        throw error;
    }
};



router.use(cookieParser());
router.get('/', async (req, res) => {
    try {
       
        const tour_status = await readJSON(DB_PATH.tournament);
        console.log(tour_status.status)
        if (tour_status.status != "ongoing" && tour_status.status != "paused")
        {
            res.render('register',{mHandicap: tour_status.mHandicap || 54})
        }
        else
        {
            // res.json({ error:"tournament has been started, can't register"  });
            res.render('login',{isAdmin:false})
            }
    } catch (error)
    {
       // console.error
    }
});

router.post('/admin/login', async (req, res) => {

    if (req.body.username == process.env.ADMIN_NAME)
    {

        const submittedHash = crypto.createHash('sha256')
                               .update(req.body.password)
                               .digest('hex')
        if (submittedHash == process.env.ADMIN_PASSWD)
        {
            adminid = uuidv4();

            res.cookie('adminid', adminid, {
                maxAge: 72000000, //~ 20 hours
                httpOnly: true,
                secure: false,
                sameSite: 'strict'
            });
            
            res.redirect(303, '/api/admin');
        }
        else
        {
            res.render('login', { isAdmin: true, message: "Wrong password" });
        }
    }
    else {
        res.render('login', { isAdmin: true, message: "Wrong username" });
    }

})

router.post('/login', async (req, res) => {
    try {
        const players = await readJSON(DB_PATH.players);
        const tournament = await readJSON(DB_PATH.tournament)
        const player = players.find(p => p.name === req.body.name && p.email === req.body.email);
        if (player)
        {
            
            //console.log(player);
            if (isOngoing())
            {
                console.log(await getCups())
                res.cookie('id', player.id, {
                        maxAge: 36000000, //~ 10 hour
                        httpOnly: true,
                        secure: false,
                        sameSite: 'strict'
                        });
                res.render("set_points", {holes:  await getCups(), scores: player.strokes, pars: await getPars(),locks:tournament.cupLocks})
            }

        }
        else
        {
            res.render("index", {message: "Player not found. Make sure the name's letter casing is correct and the email address is the same."})
        }
        
    } catch (error)
    {

    }
});


router.post('/register', async (req, res) => {
    try {
        if (await isOngoing())
        {
            res.render('index', { message: "You cannot register when the tournament is already going on." })
            return;
        }
        const players = await readJSON(DB_PATH.players);
        const player = players.find(p => p.email === req.body.email);
        if (player)
        {
            res.render("register", { message: "Failed! User already exists. Same email cannot be used for different users." })
            return;
        }
        const newPlayer = {
            id: uuidv4(),
            name: req.body.name,
            email: req.body.email, //primary
            isAdmin: false,
            isEditedByAdmin:false,
            strokes: [],
            locks: [],
            scores: [],
            score: '',
            handicap: parseInt(req.body.handicap)
        };
        
        players.push(newPlayer);
        await writeJSON(DB_PATH.players, players);
        res.render("index", {message:"Registration successful! Login once the tournament has started!"});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// CREATE NEW MATCH
// router.post('/matches', isAdmin, async (req, res) => {
//     try {
//         const matches = await readJSON(DB_PATH.matches);
//         const newMatch = {
//             id: uuidv4(),
//             players: req.body.playerIds,
//             currentPlayerTurn: req.body.playerIds[0],
//             par: parseInt(req.body.par),
//             scores: req.body.playerIds.map(playerId => ({
//                 playerId,
//                 strokes: 0
//             })),
//             status: 'ongoing'
//         };
        
//         matches.push(newMatch);
//         await writeJSON(DB_PATH.matches, matches);
//         res.json({ success: true, match: newMatch });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// });

router.post('/update-scores', async (req, res) => {
    const players = await readJSON(DB_PATH.players);
    const playerIndex = players.findIndex(p => p.id === req.cookies.id);
    const tournament = await readJSON(DB_PATH.tournament);
    if (req.cookies.id === players[playerIndex].id)
    {
        players[playerIndex].strokes = Object.keys(req.body)
        .filter(key => key.startsWith('hole_'))
        .map(key => parseInt(req.body[key]) || 0);
        await writeJSON(DB_PATH.players, players);
        
        res.render("set_points", {message: "Updated successfully!", holes:  await getCups(), scores: players[playerIndex].strokes, pars: await getPars(), locks:tournament.cupLocks})
    }
    else {
        res.render("login", { message: "Session has expired or the user doesn't exist! Try to login agian." });
    }
});
router.get('/get-scores', async (req, res) => {
    const players = await readJSON(DB_PATH.players);
    const player = players.find(p => p.id === req.cookies.id);
   
    if (!player) {
        res.json({ error: "no such player or your login time has exceeded 10 hours or more. Please login again." });
    } else {
        player.isEditedByAdmin = false;
        await writeJSON(DB_PATH.players, players);
        res.json({ scores: player.strokes });
    }
})
router.get('/get-scoreboard', async (req, res) => {
    try {
        const players = await readJSON(DB_PATH.players);
        res.json(players);
    } catch (error) {
        console.error('Error fetching scoreboard:', error);
        res.status(500).json({ error: 'Failed to fetch scoreboard data' });
    }
});
router.get('/tournament-status', async (req, res) => {
    try {
        const tournament = await readJSON(DB_PATH.tournament);
        var tournamentFinished = false;
        if (tournament.status == 'finished')
        {
            tournamentFinished = true;
        }
        res.json({tournamentFinished: tournamentFinished})
    }
    catch (error)
    {

    }
});
router.get('/get-locks', async (req, res) => {
    const tournament = await readJSON(DB_PATH.tournament);

    res.json({ locks: tournament.cupLocks });
})

router.post('/admin/update-scores', async (req, res) =>
{
    if (req.cookies.adminid == adminid)    
    {
        const players = await readJSON(DB_PATH.players);
        
        players.forEach((player,index) => {
            player.strokes = req.body.playerScores[index].scores;
            player.isEditedByAdmin = req.body.playerScores[index].isEditedByAdmin;
        });
        await writeJSON(DB_PATH.players, players);

        res.json({success: true});
        //res.redirect(303, '/api/admin?updated=true');
        console.log(req.body);
    }
    else
    {
        res.render("login", { isAdmin:false, message: "Session has expired or the user doesn't exist! Try to login agian." });
    }
})

// UPDATE PLAYER'S SCORE
// router.put('/matches/:matchId/score', isAdmin, async (req, res) => {
//     try {
//         const matches = await readJSON(DB_PATH.matches);
//         const matchIndex = matches.findIndex(m => m.id === req.params.matchId);
        
//         if (matchIndex === -1) {
//             return res.status(404).json({ error: 'Match not found' });
//         }
        
//         const scoreIndex = matches[matchIndex].scores.findIndex(
//             score => score.playerId === req.body.playerId
//         );
        
//         matches[matchIndex].scores[scoreIndex].strokes = parseInt(req.body.strokes);
//         await writeJSON(DB_PATH.matches, matches);
//         res.json({ success: true, match: matches[matchIndex] });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// });

// GET CURRENT MATCH
router.get('/matches/current', async (req, res) => {
    try {
        const [matches, players] = await Promise.all([
            readJSON(DB_PATH.matches),
            readJSON(DB_PATH.players)
        ]);
        
        const currentMatch = matches.find(m => m.status === 'ongoing');
        if (!currentMatch) return res.json({ match: null });
        
        // Add player details to match data
        const matchWithPlayers = {
            ...currentMatch,
            players: currentMatch.players.map(playerId => 
                players.find(p => p.id === playerId)
            )
        };
        
        res.json({ match: matchWithPlayers });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/view-score', async (req, res) =>
{
    try {
        const players = await readJSON(DB_PATH.players);
        const cups = await getCups();
        const reqPlObj = players.map(player => ({
                        name: player.name,
                        strokes: player.strokes,
                        score: player.score,
                         scores: player.scores
        }));
        
        res.render("score_table", {players: reqPlObj,cups:cups,path:'/api/view-score' })
    } catch (error)
    {

    }
})

router.get('/is-match-finished', async (req, res) => {

    res.json({isfinished: await !isOngoing()});
})
router.get('/is-match-paused', async (req, res) => {

    res.json({ispaused: await isPaused()});
})

router.get('/is-edited-by-admin', async (req, res) => {
    const players = await readJSON(DB_PATH.players);
    const player = players.find(p => p.id === req.cookies.id);
    if (!player)
    {
        res.json({error: "No such player exists or your login has expired, please login again by tapping the Home button or 'Golf Tournament'"})
    }
    else
    {
        res.json({ isEdited: player.isEditedByAdmin });
    }
})

router.get('/admin', async (req, res) => {
    
    if (req.cookies.adminid == adminid) //if it is truly admin
    {
        const players = await readJSON(DB_PATH.players);
        const tournament = await readJSON(DB_PATH.tournament);
        console.log(tournament.cupLocks)
        const isOn = await isOngoing(); const paused = await isPaused();
        if (req.query.Tsuccess == 'true')
        {
            
            res.render('admin-page', {message:"tournament created succesfully!", players, tournament, cups:tournament.cups || 0, isOn, paused,idle: await isIdle()});
        }
        else if (req.query.started == 'true')
        {
            res.render('admin-page', {message:"tournament resumed!", players, tournament, cups:tournament.cups || 0, isOn, paused,idle: await isIdle()});
        }
        else if (req.query.paused == 'true')
        {
            res.render('admin-page', {message:"tournament is paused! Click on Start tournament to let players enter and save scores!", players, tournament, cups:tournament.cups || 0, isOn, paused,idle: await isIdle()});
        }
        else if (req.query.stopped == 'true')
        {
            res.render('admin-page', {message:"tournament stopped! Check scoreboard!", players, tournament, cups:tournament.cups || 0, isOn, paused,idle: await isIdle()});
        }
        else if (req.query.updated == 'true')
        {
            res.render('admin-page', {message:"scores updated! Don't forget to resume (start) the tournament!", players, tournament, cups:tournament.cups || 0, isOn, paused ,idle: await isIdle()});
        }
        else if (req.query.Padded == 'true')
            {
                res.render('admin-page', {message:"Player added", players, tournament, cups:tournament.cups || 0, isOn, paused ,idle: await isIdle()});
            }
        else if (req.query.Pedited == 'true')
            {
                res.render('admin-page', {message:"Player edited", players, tournament, cups:tournament.cups || 0, isOn, paused ,idle: await isIdle()});
        }
        else if (req.query.Pdeleted == 'true')
        {
                res.render('admin-page', {message:"Player deleted", players, tournament, cups:tournament.cups || 0, isOn, paused ,idle: await isIdle()});
        }
        else
        {
            res.render('admin-page', {players, tournament, cups:tournament.cups || 0, isOn, paused, idle: await isIdle()});
        }
        
    }
    else
    {
        res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})    
     }
})

// Function to execute when timer completes
const timerCallback = async () => {
   
    await startTournament();
};
router.get('/admin/get-data', async (req, res) =>
{
    
    if (req.cookies.adminid == adminid)
    {
        const players = await readJSON(DB_PATH.players);
        const cupLocks = await getCupLocks();
        const cups = await getCups();
        const isOn = await isOngoing();
        const paused = await isPaused();
        const reqPlObj = players.map(player => ({
                        name: player.name,
                        strokes: player.strokes,
                        score: player.score,
                        scores: player.scores,
                        isEditedByAdmin: player.isEditedByAdmin
        }));
        
        res.json({players: reqPlObj,cups:cups, isOn, paused,idle: await isIdle() , cupLocks})
    }
     else
    {
        res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})    
     }
})

// Modified tournament creation endpoint
router.post('/admin/create-tournament', async (req, res) => {
    try {
        if (req.cookies.adminid == adminid) {
            const startDate = new Date(req.body.startDate);
            const endDate = new Date(req.body.endDate);
            const now = new Date();
            let status = now >= startDate ? "ongoing" : "idle";

            // Clear existing timer
            if (typeof existingTimer !== 'undefined') {
                clearTimeout(existingTimer);
            }

            // Set new timer if needed
            if (status === "idle") {
                const timeDifference = startDate.getTime() - now.getTime();
                existingTimer = setTimeout(async () => {
                    await startTournament();
                }, timeDifference);
            }

            // Validate and parse tournament data
            const tournamentData = {
                status,
                startDate: req.body.startDate,
                endDate: req.body.endDate,
                cups: parseInt(req.body.cups) || 0,
                mHandicap: parseInt(req.body.mHandicap) || 54,
                par: parseInt(req.body.par) || 0,
                pars: Array.isArray(req.body.pars)
                    ? req.body.pars.map(p => parseInt(p) || 0)
                    : new Array(parseInt(req.body.cups) || 0).fill(0),
                cupLocks: new Array(parseInt(req.body.cups) || 0).fill(false)
            };

            const players = await readJSON(DB_PATH.players);
            const maxHandicap = parseInt(req.body.mHandicap) || 54;

            if (players && players.length > 0) {
                players.forEach(player => {
                    if (player.handicap > maxHandicap) {
                        player.handicap = maxHandicap;
                    }
                });
                await writeJSON(DB_PATH.players, players);
            }


            await writeJSON(DB_PATH.tournament, tournamentData);
            res.redirect(303, '/api/admin?Tsuccess=true');
        }
        else
        {
            res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})   
        }
    } catch (error) {
        console.error('Error creating tournament:', error);
        res.status(500).json({ error: 'Failed to create tournament' });
    }
});

router.post('/admin/start-tournament', async (req, res) =>
{
    if (req.cookies.adminid == adminid) {
        startTournament();
        const players = await readJSON(DB_PATH.players);
        players.forEach(player => {
            player.strokes = []; player.scores = []; player.score = "";
        });
        await writeJSON(DB_PATH.players, players);
        res.redirect(303, '/api/admin?started=true')
    }
    else
    {
        res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})
    }
})

router.post('/admin/restart-tournament', async (req, res) =>
{
    if (req.cookies.adminid == adminid) {
        startTournament();
        res.redirect(303, '/api/admin?started=true')
    }
    else
    {
        res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})
    }
})

router.post('/admin/pause-tournament', async (req, res) =>
{
    if (req.cookies.adminid == adminid)
    {
        pauseTournament();
        res.redirect(303, '/api/admin?paused=true');
    }
    else
    {
         res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})
    }
})
router.post('/admin/stop-tournament', async (req, res) =>
{
    if (req.cookies.adminid == adminid)
    {
        stopTournament();
        calcTotalScore();
        res.redirect(303, '/api/admin?stopped=true');
    }
     else
    {
         res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})
    }
})

router.post('/admin/toggle-cup-lock', async (req, res) =>
{
    if (req.cookies.adminid == adminid) {
        const tournament = await readJSON(DB_PATH.tournament);
        tournament.cupLocks[req.body.cupIndex] = !tournament.cupLocks[req.body.cupIndex];
        if (tournament.cupLocks[req.body.cupIndex]) {
            console.log(req.body.cupIndex);
            calcScore(parseInt(req.body.cupIndex));
        }
        await writeJSON(DB_PATH.tournament, tournament);
        res.json({ success: true });
    }
     else
    {
         res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})
    }
})

router.delete('/admin/delete-player/:id', async (req, res) => {
    const playerId = req.params.id;
    const players = await readJSON(DB_PATH.players);
    const updatedPlayers = players.filter(p => p.id !== playerId);
    await writeJSON(DB_PATH.players, updatedPlayers);
    res.json({ success: true });
});


router.post('/admin/edit-player', async (req, res) => {
    if (req.cookies.adminid == adminid)
    {
        const players = await readJSON(DB_PATH.players);
        const player = players.find(p => p.id == req.body.playerId);
        player.email = req.body.email;
        player.name = req.body.name;
        player.handicap = parseInt(req.body.handicap);
        await writeJSON(DB_PATH.players, players);
        res.redirect(303, '/api/admin?Pedited=true');
    }
    else
    {
        res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})
    }
})

router.post('/admin/add-player', async (req, res) => {
    if (req.cookies.adminid == adminid)
    {

        const tournament = await readJSON(DB_PATH.tournament);
        console.log(tournament.cupLocks)
        const isOn = await isOngoing(); const paused = await isPaused();
        const players = await readJSON(DB_PATH.players);
         const player = players.find(p => p.email === req.body.email);
        if (player)
        {
            res.render("admin-page", { message: "Failed! User already exists. Same email cannot be used for different users.", players, tournament, cups:tournament.cups || 0, isOn, paused ,idle: await isIdle()});
            return;
        }
        const newPlayer = {
            id: uuidv4(),
            name: req.body.name,
            email: req.body.email, //primary
            handicap: parseInt(req.body.handicap),
            isAdmin: false,
            isEditedByAdmin:false,
            strokes: [],
            locks: [],
            scores: [],
            score: ''
        };
        
        players.push(newPlayer);
        await writeJSON(DB_PATH.players, players);
        res.redirect(303, '/api/admin?Padded=true');
    }
    else
    {
        res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"})
        }
})

module.exports = router;