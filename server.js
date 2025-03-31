import { CARD_DECKS } from './constants.js';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
    // Handle room parameter in URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const roomCode = url.searchParams.get('room');

    // If there's a room code, serve index.html
    if (roomCode) {
        fs.readFile('./index.html', (error, content) => {
            if (error) {
                res.writeHead(500);
                res.end('500 - Internal Server Error');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    // Serve static files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 - File Not Found');
            } else {
                res.writeHead(500);
                res.end('500 - Internal Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocketServer({ server });

// Store channels and their participants
const channels = new Map();

// Generate a random room code (20 characters)
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 20; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

function broadcast(channel, message, excludeClient = null) {
    if (channels.has(channel)) {
        const channelData = channels.get(channel);
        for (const [ws, data] of channelData.participants.entries()) {
            if (ws !== excludeClient && ws.readyState === 1) { // 1 = OPEN
                try {
                    ws.send(JSON.stringify(message));
                } catch (error) {
                    // Silent fail for broadcast errors
                }
            }
        }
    }
}

class Channel {
    constructor(code) {
        this.code = code;
        this.participants = new Map(); // Map of WebSocket -> {username, channel, vote}
        this.revealed = false;
        this.deckType = 'fibonacci'; // Default deck type
        this.currentCardSet = CARD_DECKS.fibonacci;
        this.summary = '';
        this.lastDeckChanger = null; // Track who last changed the deck
        this.voteCount = 0; // Track total number of votes
    }

    addParticipant(ws, username, channel) {
        if (this.participants.has(ws)) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Already joined'
            }));
            return;
        }

        // Check if username already exists and preserve their vote
        let existingVote = null;
        for (const [_, data] of this.participants.entries()) {
            if (data.username === username) {
                existingVote = data.vote;
                break;
            }
        }

        this.participants.set(ws, {
            username,
            channel,
            vote: existingVote
        });

        // Broadcast to all participants in the same channel
        broadcast(channel, {
            type: 'player_joined',
            username: username
        });

        // Send current state to the new participant
        this.broadcastState();
    }

    removeParticipant(ws) {
        const participant = this.participants.get(ws);
        if (participant) {
            const channel = participant.channel;
            // Clear the participant's vote before removing them
            if (participant.vote !== null) {
                this.voteCount--;
            }
            participant.vote = null;
            this.participants.delete(ws);
            
            // Broadcast to remaining participants in the same channel
            broadcast(channel, {
                type: 'player_left',
                username: participant.username
            });
            
            this.broadcastState();
        }
    }

    updateVote(username, vote) {
        for (const [ws, data] of this.participants.entries()) {
            if (data.username === username) {
                // Update vote count
                if (data.vote === null && vote !== null) {
                    this.voteCount++;
                } else if (data.vote !== null && vote === null) {
                    this.voteCount--;
                }
                data.vote = vote;
                // Broadcast the vote update immediately
                this.broadcastState();
                break;
            }
        }
    }

    updateCardSet(cards, deckType, username) {
        // Only update deck type if it's provided and valid
        if (deckType && (deckType === 'custom' || CARD_DECKS[deckType])) {
            this.deckType = deckType;
            this.currentCardSet = deckType === 'custom' ? cards : CARD_DECKS[deckType];
            this.lastDeckChanger = username; // Store who changed the deck
            // Clear all votes when changing card set
            this.participants.forEach(participant => {
                participant.vote = null;
            });
            this.voteCount = 0; // Reset vote count
        } else if (deckType === 'custom') {
            this.deckType = 'custom';
            this.currentCardSet = cards;
            this.lastDeckChanger = username; // Store who changed the deck
            // Clear all votes when changing card set
            this.participants.forEach(participant => {
                participant.vote = null;
            });
            this.voteCount = 0; // Reset vote count
        }
        this.broadcastState();
    }

    revealVotes() {
        this.revealed = true;
        this.broadcastState();
    }

    resetVotes() {
        this.revealed = false;
        for (const participant of this.participants.values()) {
            participant.vote = null;
        }
        this.voteCount = 0; // Reset vote count
        this.broadcastState();
    }

    broadcastState() {
        const state = {
            type: 'channel_state',
            players: Object.fromEntries(
                Array.from(this.participants.entries()).map(([ws, data]) => [
                    data.username,
                    {
                        name: data.username,
                        vote: data.vote,
                        isCurrentUser: false
                    }
                ])
            ),
            revealed: this.revealed,
            roomCode: this.code,
            cardSet: this.currentCardSet,
            deckType: this.deckType,
            lastDeckChanger: this.lastDeckChanger,
            summary: this.summary,
            voteCount: this.voteCount // Include vote count in state
        };

        for (const [ws, data] of this.participants.entries()) {
            try {
                // Create personalized state for each participant
                const personalizedState = {
                    ...state,
                    players: Object.fromEntries(
                        Object.entries(state.players).map(([name, playerData]) => [
                            name,
                            {
                                ...playerData,
                                isCurrentUser: name === data.username
                            }
                        ])
                    )
                };
                ws.send(JSON.stringify(personalizedState));
            } catch (error) {
                // Silent fail for individual participant state send errors
            }
        }
    }

    updateSummary(summary) {
        this.summary = summary;
        this.broadcastState();
    }
}

wss.on('connection', (ws) => {
    let userChannel = null;
    let username = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'join':
                    username = message.username;
                    userChannel = message.channel || generateRoomCode();

                    // Create channel if it doesn't exist
                    if (!channels.has(userChannel)) {
                        channels.set(userChannel, new Channel(userChannel));
                    }

                    const channel = channels.get(userChannel);
                    if (channel.participants.has(ws)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Already joined'
                        }));
                        return;
                    }
                    
                    if (Array.from(channel.participants.values()).some(p => p.username === username)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Username already taken'
                        }));
                        return;
                    }

                    channel.addParticipant(ws, username, userChannel);
                    break;

                case 'generateRoom':
                    const newCode = generateRoomCode();
                    ws.send(JSON.stringify({
                        type: 'roomCode',
                        code: newCode
                    }));
                    break;

                case 'vote':
                    if (userChannel && username) {
                        const channel = channels.get(userChannel);
                        if (channel) {
                            channel.updateVote(username, message.vote);
                        }
                    }
                    break;

                case 'reveal':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        if (channel) {
                            channel.revealVotes();
                        }
                    }
                    break;

                case 'reset':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        if (channel) {
                            channel.resetVotes();
                        }
                    }
                    break;

                case 'updateCardSet':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        if (channel) {
                            channel.updateCardSet(message.cards, message.deckType, username);
                        }
                    }
                    break;

                case 'throwEmoji':
                    if (!userChannel || !channels.has(userChannel)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Not in a channel'
                        }));
                        return;
                    }
                    const emojiChannel = channels.get(userChannel);
                    // Broadcast the emoji throw to all participants
                    broadcast(userChannel, {
                        type: 'emojiThrown',
                        emoji: message.emoji,
                        source: message.sourceId,
                        target: message.targetId
                    });
                    break;

                case 'updateSummary':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        if (channel) {
                            channel.updateSummary(message.summary);
                        }
                    }
                    break;

                case 'kickPlayer':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        if (channel) {
                            // Find the target player's WebSocket connection
                            const targetWs = Array.from(channel.participants.entries())
                                .find(([_, data]) => data.username === message.targetId);
                            
                            if (targetWs) {
                                // Send kick message directly to the kicked user
                                targetWs[0].send(JSON.stringify({
                                    type: 'playerKicked',
                                    playerId: message.targetId,
                                    playerName: targetWs[1].username,
                                    isKickedUser: true
                                }));

                                // Remove the player from the channel
                                channel.removeParticipant(targetWs[0]);
                                
                                // Broadcast the kick to all other participants
                                broadcast(userChannel, {
                                    type: 'playerKicked',
                                    playerId: message.targetId,
                                    playerName: targetWs[1].username,
                                    isKickedUser: false
                                }, targetWs[0]);
                            }
                        }
                    }
                    break;
            }
        } catch (error) {
            // Silent fail for message parsing errors
        }
    });

    ws.on('close', () => {
        if (userChannel) {
            const channel = channels.get(userChannel);
            if (channel) {
                channel.removeParticipant(ws);
                
                // Remove channel if empty
                if (channel.participants.size === 0) {
                    channels.delete(userChannel);
                }
            }
        }
    });
});

// Clean up empty channels every hour
setInterval(() => {
    const now = Date.now();
    for (const [channel, data] of channels.entries()) {
        if (data.participants.size === 0 && (now - data.created) > 3600000) {
            channels.delete(channel);
        }
    }
}, 3600000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 