const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

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

// Generate a random room code
function generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
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
                    console.error('Error broadcasting message:', error);
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
        this.currentCardSet = ['1', '2', '3', '5', '8', '13', '21', '?', '∞'];
        this.summary = '';
    }

    addParticipant(ws, username, channel) {
        if (this.participants.has(ws)) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Already joined'
            }));
            return;
        }

        this.participants.set(ws, {
            username,
            channel,
            vote: null
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
                data.vote = vote;
                console.log(`Updated vote for ${username}: ${vote}`);
                // Broadcast the vote update immediately
                this.broadcastState();
                break;
            }
        }
    }

    updateCardSet(cards) {
        this.currentCardSet = cards;
        this.broadcastState();
    }

    revealVotes() {
        this.revealed = true;
        console.log('Revealing votes for channel:', this.code);
        this.broadcastState();
    }

    resetVotes() {
        this.revealed = false;
        for (const participant of this.participants.values()) {
            participant.vote = null;
        }
        console.log('Resetting votes for channel:', this.code);
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
                        vote: data.vote, // Always send the vote
                        isCurrentUser: false
                    }
                ])
            ),
            revealed: this.revealed,
            roomCode: this.code,
            cardSet: this.currentCardSet,
            summary: this.summary
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
                console.log(`Sending state to ${data.username}:`, personalizedState);
                ws.send(JSON.stringify(personalizedState));
            } catch (error) {
                console.error('Error sending state to participant:', error);
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
                    
                    // Add the participant first
                    channel.addParticipant(ws, username, userChannel);

                    // Broadcast join to others
                    broadcast(userChannel, {
                        type: 'player_joined',
                        username: username
                    }, ws);

                    // Send current state to the new participant
                    channel.broadcastState();
                    break;

                case 'vote':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        channel.updateVote(username, message.vote);
                    }
                    break;

                case 'reveal':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        channel.revealVotes();
                    }
                    break;

                case 'reset':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        channel.resetVotes();
                    }
                    break;

                case 'newRound':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        channel.resetVotes();
                        channel.story = message.story || '';
                        broadcast(userChannel, {
                            type: 'roundReset',
                            story: channel.story
                        });
                    }
                    break;

                case 'updateStory':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        channel.story = message.story;
                        broadcast(userChannel, {
                            type: 'storyUpdated',
                            story: message.story
                        });
                    }
                    break;

                case 'throwEmoji':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        // Broadcast emoji to all participants
                        for (const [ws, participant] of channel.participants.entries()) {
                            try {
                                ws.send(JSON.stringify({
                                    type: 'emojiThrown',
                                    emoji: message.emoji,
                                    target: message.target,
                                    source: username
                                }));
                            } catch (error) {
                                console.error('Error sending emoji to participant:', error);
                            }
                        }
                    }
                    break;

                case 'updateCardSet':
                    if (userChannel) {
                        const channel = channels.get(userChannel);
                        channel.updateCardSet(message.cards);
                    }
                    break;

                default:
                    console.warn('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    ws.on('close', () => {
        if (userChannel && channels.has(userChannel)) {
            const channel = channels.get(userChannel);
            channel.removeParticipant(ws);

            // Remove channel if empty
            if (channel.participants.size === 0) {
                channels.delete(userChannel);
            } else {
                broadcast(userChannel, {
                    type: 'userLeft',
                    username: username,
                    participants: Array.from(channel.participants.values())
                });
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
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