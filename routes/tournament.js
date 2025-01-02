const express = require('express');

const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
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

const calculateStablefordPoints = (netStrokes, par) => {
    const relativeToPar = netStrokes - par;
    switch (true) {
        case relativeToPar <= -3: return 8;  // Albatross or better
        case relativeToPar === -2: return 5; // Eagle
        case relativeToPar === -1: return 2; // Birdie
        case relativeToPar === 0:  return 0; // Par
        case relativeToPar === 1:  return -1; // Bogey
        default: return -3;  // Double bogey or worse
    }
};

const calculateCourseHandicap = (playerHandicap, slopeRating) => {
    return Math.round(playerHandicap * (slopeRating / 113));
};


const getHandicapStrokesForHole = (courseHandicap, holeHandicapIndex , totalholes) => {
    // First stroke allocation
    if (courseHandicap >= holeHandicapIndex) return 1;
    
    // Second stroke allocation (for handicaps > 18)
    if (courseHandicap - totalholes >= holeHandicapIndex) return 2;
    
    return 0;
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


const calcScore = async (idx) => {
    try {
        const players = await readJSON(DB_PATH.players);
        const tournament = await readJSON(DB_PATH.tournament);
        
        if (!tournament.pars || !tournament.pars[idx]) {
            console.error(`No par value found for hole ${idx}`);
            return;
        }
        
        const par = tournament.pars[idx];
        
        for (const player of players) {
            // Initialize arrays if they don't exist
            if (!Array.isArray(player.points)) {
                player.points = new Array(tournament.cups).fill(null);
            }
            
            if (player.strokes &&
                Array.isArray(player.strokes) &&
                typeof player.strokes[idx] === 'number' &&
                player.strokes[idx] !== 0) {
                
                // Calculate course handicap
                const courseHandicap = calculateCourseHandicap(
                    player.handicap, 
                    tournament.slopeRating
                );
                
                // Get handicap strokes for this hole
                const handicapStrokes = getHandicapStrokesForHole(
                    courseHandicap, 
                    tournament.strokeIndex[idx],
                    tournament.cups
                );
                
                // Calculate net strokes for the hole
                const netStrokes = player.strokes[idx] - handicapStrokes;
                
                // Calculate Stableford points
                player.points[idx] = calculateStablefordPoints(netStrokes, par);
            }
        }
        
        await writeJSON(DB_PATH.players, players);
    } catch (error) {
        console.error('Error in calcScore:', error);
        throw error;
    }
};

const calcTotalScore = async () => {
    const tournament = await readJSON(DB_PATH.tournament);
    const players = await readJSON(DB_PATH.players);
    
    players.forEach(player => {
        let totalGrossStrokes = 0;
        let totalNetStrokes = 0;
        let totalPoints = 0;
        let outPoints = 0;
        let inPoints = 0;
        
        const courseHandicap = calculateCourseHandicap(
            player.handicap, 
            tournament.slopeRating
        );
        console.log("The course handicap: " + courseHandicap)
        for (let i = 0; i < player.strokes.length; i++) {
            const strokes = player.strokes[i];
            if (typeof strokes === 'number' && strokes !== 0) {
                console.log('this ran' + strokes)
                // Calculate gross strokes
                totalGrossStrokes += strokes;
                
                // Calculate handicap strokes for this hole
                const handicapStrokes = getHandicapStrokesForHole(
                    courseHandicap,
                    tournament.strokeIndex[i],
                    tournament.cups
                );
                console.log('handicap' + handicapStrokes)
                // Calculate net strokes
                const netStrokes = strokes - handicapStrokes;
                totalNetStrokes += netStrokes;

                // Calculate Stableford points
                const points = calculateStablefordPoints(netStrokes, tournament.pars[i]);
                
                // Add to total points and front/back nine
                totalPoints += points;
                if (i < (tournament.cups/2)) {
                    outPoints += points;
                } else {
                    inPoints += points;
                }
            }
        }
        
        // Update player's totals
        player.gross = totalGrossStrokes;
        player.net = totalNetStrokes;
        player.totalPoints = totalPoints;
        player.out = outPoints;
        player.in = inPoints;
    });
    
    await writeJSON(DB_PATH.players, players);
};



router.use(cookieParser());
router.get('/', async (req, res) => {
    try {
       
        const tour_status = await readJSON(DB_PATH.tournament);
        console.log(tour_status.status)
        
        if (tour_status.status != "ongoing" && tour_status.status != "paused") //need to change this to let old players log back in and see past matches, maybe use player id cookie
        {
            const curr_course_settings = await readJSON(DB_PATH.course);

            res.render('register', { mHandicap: tour_status.mHandicap || 54, courses: [{id:1, name: 'current golf course', rating: curr_course_settings.courseRating, slope: curr_course_settings.slopeRating}, { id: 2, name: 'Course 2', rating: 72.1, slope: 128 },
        // etc.
    ] })
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
            res.render("login", {message: "Player not found. Make sure the name's letter casing is correct and the email address is the same.", isAdmin:false})
        }
        
    } catch (error)
    {

    }
});

router.get('/set-strokes', async (req, res) => {
    const players = await readJSON(DB_PATH.players);
    const tournament = await readJSON(DB_PATH.tournament)

    const player = players.find(p => p.id === req.cookies.id);
    if (player && tournament.status != undefined && await isOngoing()) {

        res.render("set_points", {message:"Updated successfully!", holes: await getCups(), scores: player.strokes, pars: await getPars(), locks: tournament.cupLocks })
    }
    else
    {
        res.render("login", {message: "User not found or the tournament is not on going", isAdmin:false}) //might change this to a 303 reroute
        }
})

router.post('/register', async (req, res) => {
    try {
        const tournament = await readJSON(DB_PATH.tournament);
        if (await isOngoing())
        {
            res.render('index', { message: "You cannot register when the tournament is already going on." ,tournamentStatus: tournament.status, startDate: tournament.startDate, endDate: tournament.endDate, path:'/'})
            return;
        }
        const players = await readJSON(DB_PATH.players);
        const player = players.find(p => p.email === req.body.email);
        if (player)
        {
            const curr_course_settings = await readJSON(DB_PATH.course);
            res.render("register", { mHandicap: tournament.mHandicap || 54,courses: [{id:1, name: 'current golf course', rating: curr_course_settings.courseRating, slope: curr_course_settings.slopeRating}, { id: 2, name: 'Course 2', rating: 72.1, slope: 128 }], message: "Failed! User already exists. Same email cannot be used for different users." })
            return;
        }
        const newPlayer = {
            id: uuidv4(),
            name: req.body.name,
            email: req.body.email, //primary
            handicap: parseFloat(req.body.handicap),
            strokes: [],
            points: [],
            gross: null,
            net: null,
            out: null,
            in: null,
            totalPoints: null,
            isAdmin: false,
            isEditedByAdmin:false
        };
        
        players.push(newPlayer);
        await writeJSON(DB_PATH.players, players);
        res.render("index", {message:"Registration successful! Login once the tournament has started!",tournamentStatus: tournament.status, startDate: tournament.startDate, endDate: tournament.endDate, path:'/'});
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
        
        res.redirect(303, '/api/set-strokes'); // for 307 0r 308, you would need to change the set-strokes endpoint to POST
        //res.render("set_points", {message: "Updated successfully!", holes:  await getCups(), scores: players[playerIndex].strokes, pars: await getPars(), locks:tournament.cupLocks})
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

router.get('/view-score', async (req, res) => {
    try {
        const players = await readJSON(DB_PATH.players);
        const tournament = await readJSON(DB_PATH.tournament);
        const cups = (tournament.cups) != undefined ? tournament.pars.length : 0;
        
        const reqPlObj = players.map(player => ({
            name: player.name,
            strokes: player.strokes,
            points: player.points,
            gross: player.gross,
            net: player.net,
            handicap: player.handicap,
            totalPoints: player.totalPoints,
            out: player.strokes.slice(0, 9).reduce((a, b) => a + (b || 0), 0),
            in: player.strokes.slice(9).reduce((a, b) => a + (b || 0), 0)
        }));
        
        res.render("score_table", {
            players: reqPlObj,
            cups: cups,
            tournament: tournament,
            path:'/api/view-score'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});
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
        else if (req.query.Tupdated == 'true')
        {
            
            res.render('admin-page', {message:"tournament updated succesfully!", players, tournament, cups:tournament.cups || 0, isOn, paused,idle: await isIdle()});
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
        else if (req.query.Csuccess == 'true')
        {
            res.render('admin-page', {message:"Course settings set", players, tournament, cups:tournament.cups || 0, isOn, paused ,idle: await isIdle()});
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
                        id: player.id,
                        name: player.name,
                        email: player.email,
                        handicap: player.handicap,
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

router.post('/admin/course-setting', async (req, res) => {
    try {
        const tournament = await readJSON(DB_PATH.tournament);

        tournament.courseRating = parseFloat( req.body.courseRating); tournament.slopeRating = parseInt(req.body.slopeRating);

        await writeJSON(DB_PATH.tournament, tournament);

        const course = {
            courseRating : parseFloat( req.body.courseRating),
            slopeRating : parseInt(req.body.slopeRating)
        }
        await writeJSON(DB_PATH.course, course);

        res.redirect(303, '/api/admin?Csuccess=true');
    } catch (error)
    {
        console.log(error);
    }
})

router.post('/admin/update-tournament', async (req, res) =>
{
    try {
        if (req.cookies.adminid == adminid) {
            const current_tour = await readJSON(DB_PATH.tournament);
            const current_status = current_tour.status;
            let startDate = new Date(current_tour.startDate);
            const endDate = new Date(req.body.endDate);
            const now = new Date();
            let status = current_status;
            if (current_status  != "ongoing" && current_status != "paused")
            {
                startDate = new Date(req.body.startDate);

                 let status = (now >= startDate) ? (now >= endDate) ? "finished" : "ongoing" : "idle";
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
            }
            //let status = now >= startDate ? "ongoing" : "idle";
            const tournamentData = {
                status,
                startDate: req.body.startDate,
                endDate: req.body.endDate,
                cups: parseInt(req.body.cups) || 0,
                mHandicap: parseFloat(req.body.mHandicap) || 54,
                par: parseInt(req.body.par) || 0,
                pars: Array.isArray(req.body.pars)
                    ? req.body.pars.map(p => parseInt(p) || 0)
                    : new Array(parseInt(req.body.cups) || 0).fill(0), // if it is not an array, just create a new array with cups no. of elements
                
                strokeIndex: Array.isArray(req.body.strokeIndex)
                    ? req.body.strokeIndex.map(s => parseInt(s) || 0)
                    : new Array(parseInt(req.body.cups) || 0).fill(0),
                
                courseRating: parseFloat(req.body.courseRating),
                slopeRating: parseFloat(req.body.slopeRating),

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
            res.redirect(303, '/api/admin?Tupdated=true');


        }
        else {
            res.render('login', { isAdmin: true, message: "Not logged in as admin or session has expired! login!" })
        }
    }
    catch (error)
    {
        console.log(error);
    }
})

// tournament creation endpoint
router.post('/admin/create-tournament', async (req, res) => {
    try {
        if (req.cookies.adminid == adminid) {
            const startDate = new Date(req.body.startDate);
            const endDate = new Date(req.body.endDate);
            const now = new Date();
            //let status = now >= startDate ? "ongoing" : "idle";
            let status = (now >= startDate) ? (now >= endDate) ? "finished" : "ongoing" : "idle";
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
                mHandicap: parseFloat(req.body.mHandicap) || 54,
                par: parseInt(req.body.par) || 0,
                pars: Array.isArray(req.body.pars)
                    ? req.body.pars.map(p => parseInt(p) || 0)
                    : new Array(parseInt(req.body.cups) || 0).fill(0), // if it is not an array, just create a new array with cups no. of elements
                
                strokeIndex: Array.isArray(req.body.strokeIndex)
                    ? req.body.strokeIndex.map(s => parseInt(s) || 0)
                    : new Array(parseInt(req.body.cups) || 0).fill(0),
                
                courseRating: parseFloat(req.body.courseRating),
                slopeRating: parseFloat(req.body.slopeRating),
                
                cupLocks: new Array(parseInt(req.body.cups) || 0).fill(false)
            };

            const players = await readJSON(DB_PATH.players);
            const maxHandicap = parseInt(req.body.mHandicap) || 54;

            if (players && players.length > 0) {
                players.forEach(player => {
                    if (player.handicap > maxHandicap) {
                        player.handicap = maxHandicap;
                        player.strokes = [];
                        player.points = [];
                        player.out = null;
                        player.in = null;
                        player.gross = null;
                        player.net = null;
                        player.totalPoints = null;

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
        const tournament = await readJSON(DB_PATH.tournament);
        tournament.status = "ongoing";
        await writeJSON(DB_PATH.tournament, tournament);
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
router.post('/admin/stop-tournament', async (req, res) => {
   if (req.cookies.adminid != adminid) {
       return res.render('login', {isAdmin:true, message:"Not logged in as admin or session has expired! login!"});
   }

    try {
       await stopTournament();                                  //Check THIS TOMORROW
       const players = await readJSON(DB_PATH.players);
       const tournament = await readJSON(DB_PATH.tournament);
       const uuid = crypto.randomUUID();
       const filename = `${tournament.startDate}_${uuid}.json`;
       
       const tournamentData = {
           ...tournament,
           players: players,
           endDate: new Date().toISOString()
       };

       const pastMatchesDir = path.join(__dirname, '../data/past_matches');
       if (!fs.existsSync(pastMatchesDir)) {
           fs.mkdirSync(pastMatchesDir, { recursive: true });
       }

       await fs.promises.writeFile(
           path.join(pastMatchesDir, filename),
           JSON.stringify(tournamentData, null, 2)
       );

       
       await calcTotalScore();
       
       res.redirect(303, '/api/admin?stopped=true');
   } catch (error) {
       console.error('Error saving tournament:', error);
       res.status(500).send('Error stopping tournament');
   }
});

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


router.post('/admin/edit-player', async (req, res) => { //probably need to modify this in the future
    if (req.cookies.adminid == adminid)
    {
        const players = await readJSON(DB_PATH.players);
        const player = players.find(p => p.id == req.body.playerId);
        player.email = req.body.email;
        player.name = req.body.name;
        player.handicap = parseFloat(req.body.handicap);
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
            handicap: parseFloat(req.body.handicap),
            strokes: [],
            points: [],
            gross: null,
            net: null,
            out: null,
            in: null,
            totalPoints: null,
            isAdmin: false,
            isEditedByAdmin:false
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

router.post('/admin/tournament-list', async (req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'data', 'past_matches');
        const files = await fs.readdir(directoryPath);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        res.json({ files: jsonFiles });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to read tournament list' });
    }
});
router.post('/admin/load-tournament', async (req, res) => {
    try {
        const { filename } = req.body;
        const filePath = path.join(process.cwd(), 'data', 'past_matches', filename);
        console.log(filePath)
        const tournamentData = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        // Update tournament settings
        const tournament = await readJSON(DB_PATH.tournament);
        Object.assign(tournament, {
            cups: tournamentData.cups,
            mHandicap: tournamentData.mHandicap,
            par: tournamentData.par,
            pars: tournamentData.pars,
            strokeIndex: tournamentData.strokeIndex,
            courseRating: tournamentData.courseRating,
            slopeRating: tournamentData.slopeRating,
            cupLocks: []
        });
        
        await writeJSON(DB_PATH.tournament, tournament);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load tournament settings' });
    }
});

router.post('/admin/import-players', async (req, res) => {
    try {
        const { filename, importScores } = req.body;
        const filePath = path.join(process.cwd(), 'data', 'past_matches', filename);
        const tournamentData = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
        const players = await readJSON(DB_PATH.players);
        
        tournamentData.players.forEach(importPlayer => {
            const playerData = {
                id: importPlayer.id,
                name: importPlayer.name,
                email: importPlayer.email,
                handicap: importPlayer.handicap,
                strokes: [] ,
                isAdmin: importPlayer.isAdmin || false
            };
            
            if (importScores) {
                playerData.strokes = importPlayer.strokes;
                playerData.points = importPlayer.points;
                playerData.gross = importPlayer.gross;
                playerData.net = importPlayer.net;
                playerData.out = importPlayer.out;
                playerData.in = importPlayer.in;
                playerData.totalPoints = importPlayer.totalPoints;
            }
            
            const existingPlayerIndex = players.findIndex(p => p.id === importPlayer.id);
            if (existingPlayerIndex !== -1) {
                players[existingPlayerIndex] = playerData;
            } else {
                players.push(playerData);
            }
        });
        
        await writeJSON(DB_PATH.players, players);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to import players' });
    }
});

module.exports = router;