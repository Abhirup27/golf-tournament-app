const fs = require('fs').promises;
const path = require('path');

const DB_PATH = {
    players: path.join(__dirname, 'data', 'players.json'),
    tournament: path.join(__dirname, 'data', 'tournament.json'),
    matches: path.join(__dirname, 'data', 'matches.json'),
    course: path.join(__dirname, 'data', 'course.json' )
};

// Ensure data directory exists
const initializeDB = async () => {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
        
        // Initialize files if they don't exist
        for (const filePath of Object.values(DB_PATH)) {
            try {
                await fs.access(filePath);
            } catch {
                await fs.writeFile(filePath, JSON.stringify([]));
            }
        }
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

const readJSON = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
};

const writeJSON = async (filePath, data) => {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
        throw error;
    }
};

module.exports = {
    DB_PATH,
    initializeDB,
    readJSON,
    writeJSON
};