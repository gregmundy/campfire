import { CARD_DECKS, EMOJI_PROJECTILES } from './constants.js';

class PlanningPoker {
    constructor() {
        this.players = new Map();
        this.revealed = false;
        this.ws = null;
        this.roomCode = null;
        this.emojiSelector = null;
        this.emojiOptions = EMOJI_PROJECTILES;
        this.currentCardSet = [];
        this.currentDeckType = null; // Add tracking for current deck type
        this.previousPlayers = new Set(); // Track previous players for join notifications
        this.isFirstState = true; // Track if this is the first state update
        this.maxPlayers = 50; // Update max players limit to 50
        this.wasKicked = false; // Add flag to track if user was kicked
        this.presetDecks = CARD_DECKS;
        this.init();
        this.createForestBackground();
    }

    createForestBackground() {
        // Create forest background container
        const forest = document.createElement('div');
        forest.className = 'forest-background';
        
        // Add trees
        for (let i = 0; i < 8; i++) {
            const tree = document.createElement('div');
            tree.className = 'tree';
            forest.appendChild(tree);
        }
        
        // Add ambient particles
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 20}s`;
            particle.style.animationDuration = `${15 + Math.random() * 15}s`;
            forest.appendChild(particle);
        }
        
        document.body.insertBefore(forest, document.body.firstChild);
    }

    init() {
        // DOM elements
        this.usernameInput = document.getElementById('username');
        this.channelInput = document.getElementById('channel');
        this.joinButton = document.getElementById('join-button');
        this.generateRoomButton = document.getElementById('generate-room');
        this.joinContainer = document.querySelector('.join-container');
        this.gameContainer = document.querySelector('.game-container');
        this.roomCodeDiv = document.getElementById('room-code');
        this.roomCodeText = document.getElementById('room-code-text');
        this.playersList = document.getElementById('players-list');
        this.cardsSection = document.querySelector('.cards-section');
        this.cards = document.querySelectorAll('.card');
        this.revealButton = document.getElementById('reveal-button');
        this.resetButton = document.getElementById('reset-button');
        this.results = document.getElementById('results');
        this.connectionStatus = document.getElementById('connection-status');
        this.copyLinkButton = document.getElementById('copy-link');
        this.campfireContainer = document.querySelector('.campfire-container');
        this.customCardsInput = document.getElementById('custom-cards');
        this.updateCardsButton = document.getElementById('update-cards');
        this.deckTypeSelect = document.getElementById('deck-type');
        this.customDeckInput = document.getElementById('custom-deck-input');
        this.settingsButton = document.getElementById('settings-button');
        this.settingsModal = document.getElementById('settings-modal');

        // Populate deck options
        this.populateDeckOptions();

        // Add settings button event listeners
        if (this.settingsButton && this.settingsModal) {
            this.settingsButton.addEventListener('click', () => {
                this.settingsModal.classList.remove('hidden');
                // Force a reflow to ensure the animation starts
                this.settingsModal.offsetHeight;
            });

            // Close modal when clicking outside
            this.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.settingsModal) {
                    this.closeSettingsModal();
                }
            });

            const closeButton = this.settingsModal.querySelector('.close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    this.closeSettingsModal();
                });
            }

            // Handle escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !this.settingsModal.classList.contains('hidden')) {
                    this.closeSettingsModal();
                }
            });
        }

        // Add form submission handling
        const handleJoinSubmit = (e) => {
            e?.preventDefault();
            this.joinGame();
        };

        // Event listeners
        if (this.joinButton) {
            this.joinButton.addEventListener('click', handleJoinSubmit);
        }

        // Add keypress handlers for username and channel inputs
        if (this.usernameInput) {
            this.usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (this.channelInput.value) {
                        handleJoinSubmit(e);
                    } else {
                        this.channelInput.focus();
                    }
                }
            });
        }

        if (this.channelInput) {
            this.channelInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (this.usernameInput.value) {
                        handleJoinSubmit(e);
                    } else {
                        this.usernameInput.focus();
                    }
                }
            });
        }

        if (this.generateRoomButton) {
            this.generateRoomButton.addEventListener('click', () => this.generateRoomCode());
        }
        
        // Add click handlers to initial cards
        this.attachCardEventListeners();
        
        if (this.revealButton) {
            this.revealButton.addEventListener('click', () => this.revealVotes());
        }
        
        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => this.resetVotes());
        }
        
        if (this.copyLinkButton) {
            this.copyLinkButton.addEventListener('click', () => this.copyRoomLink());
        }
        
        // Add deck type change handler
        if (this.deckTypeSelect) {
            this.deckTypeSelect.addEventListener('change', () => this.handleDeckTypeChange());
        }
        
        // Custom cards event listeners
        if (this.customCardsInput && this.updateCardsButton) {
            this.updateCardsButton.addEventListener('click', () => this.updateCardSet());
            this.customCardsInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.updateCardSet();
                }
            });
        }
        
        document.addEventListener('click', (e) => this.handleGlobalClick(e));

        // Check for room code in URL
        this.checkUrlForRoomCode();
    }

    populateDeckOptions() {
        if (!this.deckTypeSelect) return;

        // Clear existing options except the custom option
        const customOption = this.deckTypeSelect.querySelector('option[value="custom"]');
        this.deckTypeSelect.innerHTML = '';

        // Add all preset decks
        Object.entries(this.presetDecks).forEach(([key, cards]) => {
            const option = document.createElement('option');
            option.value = key;
            
            // Format the deck name based on the key
            let deckName = key.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            
            // Add the cards to the display text
            option.textContent = `${deckName} (${cards.join(', ')})`;
            
            this.deckTypeSelect.appendChild(option);
        });

        // Add back the custom option
        this.deckTypeSelect.appendChild(customOption);
    }

    attachCardEventListeners() {
        if (this.cardsSection) {
            const cards = this.cardsSection.querySelectorAll('.card');
            cards.forEach(card => {
                card.onclick = () => this.selectCard(card);
            });
            // Update the cards reference
            this.cards = cards;
        }
    }

    checkUrlForRoomCode() {
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('room');
        if (roomCode) {
            this.channelInput.value = roomCode;
            this.roomCode = roomCode;
            // Auto-focus the username input if we have a room code
            this.usernameInput.focus();
        } else {
            // If no room code in URL, connect to WebSocket and generate one automatically
            this.connectWebSocket();
        }
    }

    copyRoomLink() {
        if (!this.roomCode) return;

        const url = new URL(window.location.href);
        url.searchParams.set('room', this.roomCode);
        const cleanUrl = `${url.origin}${url.pathname}?room=${this.roomCode}`;
        
        navigator.clipboard.writeText(cleanUrl).then(() => {
            const originalText = this.copyLinkButton.textContent;
            this.copyLinkButton.textContent = 'Copied!';
            this.copyLinkButton.style.background = 'rgba(72, 187, 120, 0.4)';
            
            setTimeout(() => {
                this.copyLinkButton.textContent = 'Copy';
                this.copyLinkButton.style.background = '';
            }, 2000);
        }).catch(() => {
            this.showErrorNotification('Failed to copy link. Please try again.');
        });
    }

    connectWebSocket() {
        // Don't reconnect if user was kicked
        if (this.wasKicked) {
            return;
        }

        // Clean up any existing connection
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Hide connection status initially
        if (this.connectionStatus) {
            this.connectionStatus.classList.remove('connected', 'disconnected');
            this.connectionStatus.style.opacity = '0';
            this.connectionStatus.style.pointerEvents = 'none';
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        // Store join info if we're trying to connect as part of joining
        this.pendingJoin = null;
        if (this.usernameInput?.value && this.channelInput?.value) {
            this.pendingJoin = {
                username: this.usernameInput.value.trim(),
                channel: this.channelInput.value.trim()
            };
        }

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            // Only show connection status if we're actually in a room
            if (this.roomCode) {
                if (this.connectionStatus) {
                    this.connectionStatus.classList.add('connected');
                    this.connectionStatus.innerHTML = '<span>Connected</span>';
                    this.connectionStatus.style.opacity = '1';
                    this.connectionStatus.style.pointerEvents = 'auto';
                }
            }
            
            // If we have pending join info, send it now
            if (this.pendingJoin) {
                this.ws.send(JSON.stringify({
                    type: 'join',
                    username: this.pendingJoin.username,
                    channel: this.pendingJoin.channel
                }));
                this.pendingJoin = null;
            } else if (!this.channelInput.value) {
                // If no room code is entered, generate one automatically
                this.ws.send(JSON.stringify({
                    type: 'generateRoom'
                }));
            }
        };

        this.ws.onclose = () => {
            // Only show disconnected state if we were previously in a room
            if (this.roomCode) {
                if (this.connectionStatus) {
                    this.connectionStatus.classList.remove('connected');
                    this.connectionStatus.classList.add('disconnected');
                    this.connectionStatus.innerHTML = '<span>Disconnected</span>';
                    this.connectionStatus.style.opacity = '1';
                    this.connectionStatus.style.pointerEvents = 'auto';
                }
            }
            
            // Reset room state on disconnect
            this.roomCode = null;
            this.players = new Map();
            this.revealed = false;
            
            // Only try to reconnect if user wasn't kicked and was in a room
            if (!this.wasKicked && this.roomCode) {
                setTimeout(() => this.connectWebSocket(), 2000);
            }
        };

        this.ws.onerror = () => {
            if (!this.wasKicked) {
                this.showErrorNotification('Connection error. Retrying...');
            }
        };

        this.ws.onmessage = (event) => {
            try {
                this.handleMessage(event);
            } catch {
                this.showErrorNotification('Error processing message');
            }
        };
    }

    joinGame() {
        const username = this.usernameInput.value.trim();
        const channel = this.channelInput.value.trim();
        
        if (!username) {
            this.showErrorNotification('Please enter a username');
            this.usernameInput.focus();
            return;
        }

        if (!channel) {
            this.showErrorNotification('Please enter a room code');
            this.channelInput.focus();
            return;
        }

        // Check current player count before joining
        if (this.players.size >= this.maxPlayers) {
            this.showErrorNotification(`Room is full (max ${this.maxPlayers} players)`);
            return;
        }

        // If WebSocket isn't connected, connect and store join info
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.pendingJoin = { username, channel };
            this.connectWebSocket();
            return;
        }

        // Send join message if connected
        this.ws.send(JSON.stringify({
            type: 'join',
            username: username,
            channel: channel
        }));
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('=== handleMessage called ===');
            console.log('Message type:', message.type);
            console.log('Current state:', {
                revealed: this.revealed,
                currentUserVote: Array.from(this.players.entries())
                    .find(([_, player]) => player.isCurrentUser)?.[1]?.vote
            });

            // Handle player kick first, before any other state updates
            if (message.type === 'playerKicked') {
                console.log('=== KICK MESSAGE RECEIVED ===');
                console.log('Kick message details:', {
                    playerId: message.playerId,
                    playerName: message.playerName,
                    isKickedUser: message.isKickedUser,
                    currentPlayers: Array.from(this.players.keys())
                });
                
                // Check if this user was kicked
                if (message.isKickedUser) {
                    // This user was kicked
                    console.log('Current user was kicked');
                    
                    // Set kicked flag to prevent reconnection
                    this.wasKicked = true;
                    
                    // Show kicked notification
                    this.showErrorNotification('You have been removed from the room');
                    
                    // Reset the game state
                    this.resetGameState();
                    
                    // Show join container
                    if (this.joinContainer) {
                        this.joinContainer.classList.remove('hidden');
                    }
                    
                    // Hide game container
                    if (this.gameContainer) {
                        this.gameContainer.classList.add('hidden');
                    }
                    
                    // Hide connection status
                    if (this.connectionStatus) {
                        this.connectionStatus.classList.remove('connected', 'disconnected');
                        this.connectionStatus.style.opacity = '0';
                        this.connectionStatus.style.pointerEvents = 'none';
                    }
                    
                    // Show persistent kick popup
                    this.showKickPopup();
                    
                    // Close the WebSocket connection
                    if (this.ws) {
                        this.ws.close();
                    }
                    
                    return;
                }
                
                // Remove player from local state
                if (this.players.has(message.playerId)) {
                    console.log('Found player in local state, removing...');
                    this.players.delete(message.playerId);
                    
                    // Remove player from circle if present
                    const playerWrapper = document.querySelector(`.player-wrapper[data-player-id="${message.playerId}"]`);
                    if (playerWrapper) {
                        console.log('Found player wrapper in circle, removing...');
                        playerWrapper.remove();
                    } else {
                        console.log('No player wrapper found in circle');
                    }
                    
                    // Remove player from table if present
                    const playerRow = document.querySelector(`.player-row[data-player-id="${message.playerId}"]`);
                    if (playerRow) {
                        console.log('Found player row in table, removing...');
                        playerRow.remove();
                    } else {
                        console.log('No player row found in table');
                    }
                    
                    // Update the UI to reflect the change
                    console.log('Updating players list after kick');
                    this.updatePlayersList(Object.fromEntries(this.players), message);
                } else {
                    console.log('Player not found in local state:', message.playerId);
                }
                this.showPlayerKickedNotification(message.playerName);
                return; // Exit early after handling kick
            }

            // Handle other message types
            switch (message.type) {
                case 'roomCode':
                    this.channelInput.value = message.code;
                    break;
                case 'channel_state':
                    console.log('=== Processing channel_state ===');
                    console.log('Channel state details:', {
                        players: Object.keys(message.players),
                        currentPlayers: Array.from(this.players.keys()),
                        revealed: message.revealed
                    });
                    
                    // Check player limit before updating state
                    if (Object.keys(message.players).length > this.maxPlayers) {
                        this.showErrorNotification(`Room is full (max ${this.maxPlayers} players)`);
                        return;
                    }
                    
                    // Show game UI on first successful channel state
                    if (this.isFirstState) {
                        if (this.gameContainer) {
                            this.gameContainer.classList.remove('hidden');
                        }
                        if (this.joinContainer) {
                            this.joinContainer.classList.add('hidden');
                        }
                        // Hide the room info section
                        const roomInfo = document.getElementById('room-info');
                        if (roomInfo) {
                            roomInfo.classList.add('hidden');
                        }
                        if (this.revealButton) {
                            this.revealButton.classList.remove('hidden');
                        }
                        
                        // Show connection status now that we're in a room
                        if (this.connectionStatus) {
                            this.connectionStatus.classList.add('connected');
                            this.connectionStatus.innerHTML = '<span>Connected</span>';
                            this.connectionStatus.style.opacity = '1';
                            this.connectionStatus.style.pointerEvents = 'auto';
                        }
                        
                        // Show self join notification on initial state
                        const currentPlayer = Object.entries(message.players)
                            .find(([_, player]) => player.isCurrentUser);
                        if (currentPlayer) {
                            this.showPlayerJoinNotification(currentPlayer[1].name);
                        }
                        
                        this.isFirstState = false;
                    }
                    
                    // Update room code if it exists in the message
                    if (message.roomCode) {
                        this.updateRoomCode(message.roomCode);
                    }
                    
                    // Update all players with the latest state from the server
                    Object.entries(message.players).forEach(([username, player]) => {
                        console.log('Updating player state:', {
                            username,
                            oldVote: this.players.get(username)?.vote,
                            newVote: player.vote,
                            isCurrentUser: player.isCurrentUser
                        });
                        this.players.set(username, {
                            vote: player.vote,
                            isCurrentUser: player.isCurrentUser
                        });
                        // Update the player card with their vote state
                        this.updatePlayerCard(username, player.vote);
                    });
                    
                    // Remove players that are no longer in the room
                    Array.from(this.players.keys()).forEach(username => {
                        if (!message.players[username]) {
                            console.log('Removing player that left:', username);
                            this.players.delete(username);
                            const playerWrapper = document.querySelector(`.player-wrapper[data-player-id="${username}"]`);
                            if (playerWrapper) {
                                playerWrapper.remove();
                            }
                            const playerRow = document.querySelector(`.player-row[data-player-id="${username}"]`);
                            if (playerRow) {
                                playerRow.remove();
                            }
                        }
                    });
                    
                    // Update players list and room code
                    this.updatePlayersList(message.players, message);
                    this.roomCode = message.roomCode;
                    
                    // Update voting state visibility
                    this.updateVotingState(message.revealed);
                    
                    if (message.cardSet && JSON.stringify(message.cardSet) !== JSON.stringify(this.currentCardSet)) {
                        this.currentCardSet = message.cardSet;
                        this.updateCardSetUI(message.cardSet);
                        
                        // Only show notification if deck type actually changed and we're not in initial state
                        // AND the change wasn't triggered by our own join
                        if (!this.isFirstState && message.deckType && message.deckType !== this.currentDeckType && this.currentDeckType !== null) {
                            this.showDeckChangeNotification(message.deckType, message.lastDeckChanger);
                        }
                        // Update current deck type
                        this.currentDeckType = message.deckType;
                    }
                    
                    // Sync deck type in UI
                    if (message.deckType && this.deckTypeSelect) {
                        if (this.deckTypeSelect.value !== message.deckType) {
                            this.deckTypeSelect.value = message.deckType;
                            if (message.deckType === 'custom') {
                                this.customDeckInput.classList.remove('hidden');
                                if (this.customCardsInput) {
                                    this.customCardsInput.value = message.cardSet.join(', ');
                                }
                            } else {
                                this.customDeckInput.classList.add('hidden');
                            }
                        }
                    }
                    
                    if (message.summary !== undefined) {
                        this.updateSummary(message.summary);
                    }
                    break;
                case 'player_joined':
                    this.showPlayerJoinNotification(message.username);
                    break;
                case 'player_left':
                    this.showPlayerLeftNotification(message.username);
                    break;
                case 'emojiThrown':
                    console.log('Handling emoji throw:', message); // Add logging
                    this.handleEmojiThrown(message);
                    break;
                case 'error':
                    if (message.message === 'Already joined') {
                        // Hide connection status
                        if (this.connectionStatus) {
                            this.connectionStatus.classList.remove('connected', 'disconnected');
                            this.connectionStatus.style.opacity = '0';
                            this.connectionStatus.style.pointerEvents = 'none';
                        }
                        // Close the WebSocket connection if username is already taken
                        if (this.ws) {
                            this.ws.close();
                        }
                        return;
                    }
                    this.showErrorNotification(message.message);
                    break;
                default:
                    this.showErrorNotification('Unknown message type received');
            }
        } catch (error) {
            console.error('Error processing message:', error);
            this.showErrorNotification('Error processing message');
        }
    }

    updateCardSetUI(cardSet) {
        if (!this.cardsSection) return;

        // Clear existing cards
        this.cardsSection.innerHTML = '';

        // Create new cards
        cardSet.forEach(value => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.value = value;
            card.textContent = value;
            this.cardsSection.appendChild(card);
        });

        // Clear votes when changing card set
        this.players.forEach(player => {
            player.vote = null;
        });

        // Attach event listeners to new cards
        this.attachCardEventListeners();
    }

    updateCardSet() {
        if (!this.customCardsInput) return;

        const values = this.customCardsInput.value
            .split(',')
            .map(v => v.trim())
            .filter(v => v.length > 0);

        if (values.length === 0) {
            this.showErrorNotification('Please enter at least one card value');
            return;
        }

        // Send the new card set to the server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'updateCardSet',
                cards: values,
                deckType: 'custom' // Explicitly set as custom for custom card sets
            }));
        }
    }

    handleVote(message) {
        const player = this.players.get(message.username);
        if (player) {
            player.vote = message.hasVoted ? '?' : null;
            this.updatePlayersList();
        }
    }

    handleReveal(message) {
        this.revealed = true;
        
        // Update all player votes from the message
        message.votes.forEach(([username, vote]) => {
            const player = this.players.get(username);
            if (player) {
                player.vote = vote;
                // Update the player's card immediately
                this.updatePlayerCard(username, vote);
                // Update the player's table row if it exists
                this.updatePlayerTableRow(username, vote);
            }
        });

        // Update the UI to show all votes
        this.updatePlayersList(Object.fromEntries(this.players), message);
        this.showResults(message.votes);
    }

    handleReset(message) {
        this.revealed = false;
        // Only clear votes when explicitly resetting
        this.players.forEach(player => {
            player.vote = null;
        });
        this.cards.forEach(card => card.classList.remove('selected'));
        this.results.classList.add('hidden');
        this.revealButton.textContent = 'Reveal Votes';
        this.updatePlayersList();
    }

    handleEmojiThrown(data) {
        console.log('Handling emoji throw with data:', data);
        
        // Find the source player's wrapper
        const sourceWrapper = document.querySelector(`.player-wrapper[data-player-id="${data.source}"]`);
        if (!sourceWrapper) {
            console.log('Source wrapper not found:', data.source);
            return;
        }
        console.log('Found source wrapper:', sourceWrapper);

        // Find the target player's wrapper using the target ID
        const targetWrapper = document.querySelector(`.player-wrapper[data-player-id="${data.target}"]`);
        if (!targetWrapper) {
            console.log('Target wrapper not found:', data.target);
            return;
        }
        console.log('Found target wrapper:', targetWrapper);

        const targetCard = targetWrapper.querySelector('.player-card');
        const sourceCard = sourceWrapper.querySelector('.player-card');
        
        if (!targetCard || !sourceCard) {
            console.log('Cards not found');
            return;
        }
        console.log('Found both cards');

        const targetRect = targetCard.getBoundingClientRect();
        const sourceRect = sourceCard.getBoundingClientRect();
        
        // Calculate center points of both cards
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        const sourceX = sourceRect.left + sourceRect.width / 2;
        const sourceY = sourceRect.top + sourceRect.height / 2;

        console.log('Calculated positions:', {
            source: { x: sourceX, y: sourceY },
            target: { x: targetX, y: targetY }
        });

        // Create projectile
        const projectile = document.createElement('div');
        projectile.className = 'emoji-projectile';
        projectile.textContent = data.emoji;
        projectile.style.left = `${sourceX}px`;
        projectile.style.top = `${sourceY}px`;
        document.body.appendChild(projectile);
        console.log('Created projectile');

        // Calculate the angle between source and target
        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
        
        // Calculate the distance to target
        const distance = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2));
        
        // Calculate bounce offset based on angle
        const bounceDistance = 50; // pixels to bounce
        const bounceX = Math.cos(angle) * bounceDistance;
        const bounceY = Math.sin(angle) * bounceDistance;

        // Set CSS variables for animation
        projectile.style.setProperty('--target-x', `${targetX - sourceX}px`);
        projectile.style.setProperty('--target-y', `${targetY - sourceY}px`);
        projectile.style.setProperty('--bounce-x', `${bounceX}px`);
        projectile.style.setProperty('--bounce-y', `${bounceY}px`);

        console.log('Set animation variables:', {
            targetX: targetX - sourceX,
            targetY: targetY - sourceY,
            bounceX,
            bounceY
        });

        // Create hit effect
        const hitEffect = document.createElement('div');
        hitEffect.className = 'emoji-hit';
        hitEffect.textContent = data.emoji;
        hitEffect.style.left = `${targetX}px`;
        hitEffect.style.top = `${targetY}px`;
        document.body.appendChild(hitEffect);
        console.log('Created hit effect');

        // Add hit animation to target card
        targetCard.classList.add('hit');

        // Remove elements after animation
        setTimeout(() => {
            projectile.remove();
            hitEffect.remove();
            targetCard.classList.remove('hit');
        }, 1000);
    }

    selectCard(card) {
        console.log('=== selectCard called ===');
        console.log('Current state:', {
            revealed: this.revealed,
            wsState: this.ws?.readyState,
            currentVote: Array.from(this.players.entries())
                .find(([_, player]) => player.isCurrentUser)?.[1]?.vote
        });

        if (this.revealed) {
            this.showErrorNotification("Can't vote while votes are revealed");
            return;
        }
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showErrorNotification('Not connected to server. Reconnecting...');
            this.connectWebSocket();
            return;
        }

        // Check if this card is already selected
        const isCurrentlySelected = card.classList.contains('selected');
        
        // Remove selected class from all cards
        if (this.cardsSection) {
            this.cardsSection.querySelectorAll('.card').forEach(c => {
                c.classList.remove('selected');
                // Remove any existing checkmark
                const existingCheckmark = c.querySelector('.checkmark');
                if (existingCheckmark) {
                    existingCheckmark.remove();
                }
            });
        }
        
        // If the card was already selected, we're unselecting it
        if (isCurrentlySelected) {
            console.log('Unselecting card');
            // Send null vote to server to clear the vote
            try {
                // Update the player's own card in the circle immediately
                const currentUser = Array.from(this.players.entries())
                    .find(([_, player]) => player.isCurrentUser);
                
                if (currentUser) {
                    console.log('Updating local state for current user:', {
                        userId: currentUser[0],
                        oldVote: currentUser[1].vote,
                        newVote: null
                    });
                    // Update the player's vote in the local state
                    currentUser[1].vote = null;
                    // Update the UI
                    this.updatePlayerCard(currentUser[0], null);
                }
                
                // Send null vote to server
                this.ws.send(JSON.stringify({
                    type: 'vote',
                    vote: null
                }));
            } catch (error) {
                console.error('Error clearing vote:', error);
                this.showErrorNotification('Failed to clear vote. Please try again.');
            }
            return;
        }
        
        // Add selected class and checkmark to clicked card
        card.classList.add('selected');
        
        // Create and add checkmark to the card
        const checkmark = document.createElement('div');
        checkmark.className = 'checkmark';
        checkmark.innerHTML = '✓';
        card.appendChild(checkmark);
        
        // Send vote to server
        try {
            const voteValue = card.dataset.value;
            console.log('Sending vote to server:', voteValue);
            
            // Update the player's own card in the circle immediately
            const currentUser = Array.from(this.players.entries())
                .find(([_, player]) => player.isCurrentUser);
            
            if (currentUser) {
                console.log('Updating local state for current user:', {
                    userId: currentUser[0],
                    oldVote: currentUser[1].vote,
                    newVote: voteValue
                });
                // Update the player's vote in the local state
                currentUser[1].vote = voteValue;
                // Update the UI
                this.updatePlayerCard(currentUser[0], voteValue);
            } else {
                console.log('No current user found in players map');
            }
            
            // Send vote to server after updating local state
            this.ws.send(JSON.stringify({
                type: 'vote',
                vote: voteValue
            }));
        } catch (error) {
            console.error('Error sending vote:', error);
            this.showErrorNotification('Failed to send vote. Please try again.');
            card.classList.remove('selected');
            const checkmark = card.querySelector('.checkmark');
            if (checkmark) {
                checkmark.remove();
            }
        }
    }

    showPlayerJoinNotification(playerName) {
        const notification = document.createElement('div');
        notification.className = 'player-join-notification';
        notification.textContent = `${playerName} has joined the room!`;
        document.body.appendChild(notification);

        // Remove the notification after animation completes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showPlayerLeftNotification(playerName) {
        const notification = document.createElement('div');
        notification.className = 'player-join-notification';
        notification.textContent = `${playerName} has left the room`;
        document.body.appendChild(notification);

        // Remove the notification after animation completes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showPlayerKickedNotification(playerName) {
        const notification = document.createElement('div');
        notification.className = 'player-join-notification error';
        notification.textContent = `${playerName} has been removed from the game`;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    updatePlayersList(players, message) {
        // Update the players Map with the provided players
        if (players) {
            this.players = new Map(Object.entries(players));
        }

        // Update user counter
        const userCounter = document.querySelector('.user-counter');
        if (userCounter) {
            userCounter.textContent = `${this.players.size} users`;
        }

        const playersList = document.querySelector('.players-circle');
        const campfireContainer = document.querySelector('.campfire-container');
        if (!playersList || !campfireContainer) return;

        // First, find the current user
        const currentUserEntry = Array.from(this.players.entries())
            .find(([_, player]) => player.isCurrentUser);

        // Sort remaining players by ID (which correlates to join time)
        const otherPlayers = Array.from(this.players.entries())
            .filter(([_, player]) => !player.isCurrentUser)
            .sort(([idA], [idB]) => idA.localeCompare(idB));

        // Combine players: current user first, then others up to 3 more (max 4 total)
        const circlePlayers = currentUserEntry ? [currentUserEntry] : [];
        circlePlayers.push(...otherPlayers.slice(0, 3));

        // Calculate positions for circle players
        const containerWidth = campfireContainer.offsetWidth;
        const containerHeight = campfireContainer.offsetHeight;
        const safeAreaTop = 100;
        const safeAreaBottom = 160;
        const usableHeight = containerHeight - safeAreaTop - safeAreaBottom;
        const usableWidth = containerWidth;
        const minDimension = Math.min(usableWidth, usableHeight);
        const centerX = containerWidth / 2;
        const centerY = (containerHeight - safeAreaBottom + safeAreaTop) / 2;
        const radius = minDimension * 0.52;
        const minSpacing = circlePlayers.length <= 6 ? 180 : 160;
        const circumference = 2 * Math.PI * radius;
        const spacing = circumference / circlePlayers.length;
        const finalRadius = spacing < minSpacing ? (minSpacing * circlePlayers.length) / (2 * Math.PI) : radius;

        // Create or update players in the circle
        circlePlayers.forEach(([id, player], index) => {
            const angle = (-Math.PI / 2) + (index * (2 * Math.PI / circlePlayers.length));
            const x = centerX + finalRadius * Math.cos(angle);
            const y = centerY + finalRadius * Math.sin(angle);
            
            // Check if player wrapper already exists
            let playerWrapper = document.querySelector(`.player-wrapper[data-player-id="${id}"]`);
            
            if (!playerWrapper) {
                // Create new wrapper if it doesn't exist
                playerWrapper = document.createElement('div');
                playerWrapper.className = 'player-wrapper';
                playerWrapper.dataset.playerId = id;
                playerWrapper.dataset.circle = "1";
                playerWrapper.style.left = `${x}px`;
                playerWrapper.style.top = `${y}px`;

                if (!player.isCurrentUser) {
                    playerWrapper.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.showEmojiSelector(e, { name: id, id: id });
                    });
                    playerWrapper.style.cursor = 'pointer';
                }

                const playerCard = document.createElement('div');
                playerCard.className = 'player-card';
                if (player.isCurrentUser) {
                    playerCard.classList.add('current-user');
                    playerWrapper.style.cursor = 'default';
                }
                
                const voteIndicator = document.createElement('div');
                voteIndicator.className = 'vote-indicator not-voted';
                // Set initial vote state
                if (!this.revealed) {
                    voteIndicator.textContent = player.vote ? '✓' : '🤔';
                    voteIndicator.className = player.vote ? 'vote-indicator has-voted' : 'vote-indicator not-voted';
                } else {
                    voteIndicator.textContent = player.vote || '🤔';
                    voteIndicator.className = player.vote ? 'vote-indicator revealed' : 'vote-indicator not-voted';
                }

                const nameContainer = document.createElement('div');
                nameContainer.className = 'name-container';

                const playerName = document.createElement('span');
                playerName.className = 'player-name';
                playerName.textContent = id;
                playerName.setAttribute('data-name', id);

                const youIndicator = document.createElement('span');
                youIndicator.className = 'you-indicator';
                youIndicator.textContent = 'You';

                nameContainer.appendChild(playerName);
                if (player.isCurrentUser) {
                    nameContainer.appendChild(youIndicator);
                }

                playerCard.appendChild(voteIndicator);
                playerWrapper.appendChild(playerCard);
                playerWrapper.appendChild(nameContainer);
                playersList.appendChild(playerWrapper);
            } else {
                // Update existing wrapper position
                playerWrapper.style.left = `${x}px`;
                playerWrapper.style.top = `${y}px`;
                
                // Update player name if it changed
                const nameElement = playerWrapper.querySelector('.player-name');
                if (nameElement && nameElement.textContent !== id) {
                    nameElement.textContent = id;
                }

                // Update vote indicator without recreating it
                const voteIndicator = playerWrapper.querySelector('.vote-indicator');
                if (voteIndicator) {
                    if (!this.revealed) {
                        if (player.vote === null) {
                            voteIndicator.textContent = '🤔';
                            voteIndicator.className = 'vote-indicator not-voted';
                        } else {
                            voteIndicator.textContent = '✓';
                            voteIndicator.className = 'vote-indicator has-voted';
                        }
                    } else {
                        if (player.vote === null) {
                            voteIndicator.textContent = '🤔';
                            voteIndicator.className = 'vote-indicator not-voted';
                        } else {
                            voteIndicator.textContent = player.vote;
                            voteIndicator.className = 'vote-indicator revealed';
                        }
                    }
                }
            }
        });

        // Handle additional players in table
        const tablePlayers = otherPlayers.slice(3);
        
        // Remove existing side panel if present
        const existingSidePanel = document.querySelector('.side-panel');
        if (existingSidePanel) {
            existingSidePanel.remove();
        }

        // Create side panel container
        const sidePanel = document.createElement('div');
        sidePanel.className = 'side-panel';

        // Only create table if there are additional players
        if (tablePlayers.length > 0) {
            // Create table container
            const tableContainer = document.createElement('div');
            tableContainer.className = 'additional-players-table';
            
            // Add header
            const header = document.createElement('h3');
            header.textContent = `Additional Players (${tablePlayers.length})`;
            tableContainer.appendChild(header);

            // Create grid for player rows
            const tableGrid = document.createElement('div');
            tableGrid.className = 'table-grid';

            // Add player rows
            tablePlayers.forEach(([id, player]) => {
                const playerRow = document.createElement('div');
                playerRow.className = 'player-row';
                playerRow.dataset.playerId = id;

                // Add click handler for emoji selector
                if (!player.isCurrentUser) {
                    playerRow.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.showEmojiSelector(e, { name: id, id: id });
                    });
                    playerRow.style.cursor = 'pointer';
                }

                const nameSpan = document.createElement('span');
                nameSpan.className = 'name';
                nameSpan.textContent = id + (player.isCurrentUser ? ' (You)' : '');

                const statusSpan = document.createElement('span');
                statusSpan.className = `status ${player.vote ? '' : 'waiting'}`;
                statusSpan.textContent = player.vote ? (this.revealed ? player.vote : '✓') : 'Waiting';

                playerRow.appendChild(nameSpan);
                playerRow.appendChild(statusSpan);
                tableGrid.appendChild(playerRow);
            });

            tableContainer.appendChild(tableGrid);
            sidePanel.appendChild(tableContainer);
        }

        // Create HUD container
        const hud = document.createElement('div');
        hud.className = 'game-hud';

        // Calculate voting progress using server's vote count
        const totalPlayers = this.players.size;
        const votedPlayers = message?.voteCount || Array.from(this.players.values()).filter(player => player.vote !== null).length;
        const progress = totalPlayers > 0 ? (votedPlayers / totalPlayers) * 100 : 0;

        // Create circular progress container
        const progressContainer = document.createElement('div');
        progressContainer.className = 'hud-progress-container';

        // Create SVG for circular progress
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 36 36');
        svg.classList.add('hud-progress-circle');

        // Background circle
        const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        backgroundCircle.setAttribute('d', 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831');
        backgroundCircle.setAttribute('fill', 'none');
        backgroundCircle.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
        backgroundCircle.setAttribute('stroke-width', '3');

        // Progress circle
        const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        progressCircle.setAttribute('d', 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831');
        progressCircle.setAttribute('fill', 'none');
        progressCircle.setAttribute('stroke', '#4CAF50');
        progressCircle.setAttribute('stroke-width', '3');
        progressCircle.setAttribute('stroke-dasharray', `${progress}, 100`);

        // Add circles to SVG
        svg.appendChild(backgroundCircle);
        svg.appendChild(progressCircle);

        // Create progress text container
        const progressText = document.createElement('div');
        progressText.className = 'hud-progress-text';
        progressText.innerHTML = `
            <span class="progress-number">${votedPlayers}/${totalPlayers}</span>
            <span class="progress-label">Votes</span>
        `;

        // Add elements to progress container
        progressContainer.appendChild(svg);
        progressContainer.appendChild(progressText);

        // Add progress container to HUD
        hud.appendChild(progressContainer);

        // Add HUD to side panel
        sidePanel.appendChild(hud);

        // Add side panel to document
        document.body.appendChild(sidePanel);
    }

    updateHUD() {
        // Remove existing HUD if present
        const existingHUD = document.querySelector('.game-hud');
        if (existingHUD) {
            existingHUD.remove();
        }

        // Create new HUD container
        const hud = document.createElement('div');
        hud.className = 'game-hud';

        // Calculate voting progress
        const totalPlayers = this.players.size;
        const votedPlayers = Array.from(this.players.values()).filter(player => player.vote !== null).length;
        const progress = totalPlayers > 0 ? (votedPlayers / totalPlayers) * 100 : 0;

        // Create circular progress container
        const progressContainer = document.createElement('div');
        progressContainer.className = 'hud-progress-container';

        // Create SVG for circular progress
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 36 36');
        svg.classList.add('hud-progress-circle');

        // Background circle
        const backgroundCircle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        backgroundCircle.setAttribute('d', 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831');
        backgroundCircle.setAttribute('fill', 'none');
        backgroundCircle.setAttribute('stroke', 'rgba(255, 255, 255, 0.1)');
        backgroundCircle.setAttribute('stroke-width', '3');

        // Progress circle
        const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        progressCircle.setAttribute('d', 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831');
        progressCircle.setAttribute('fill', 'none');
        progressCircle.setAttribute('stroke', '#4CAF50');
        progressCircle.setAttribute('stroke-width', '3');
        progressCircle.setAttribute('stroke-dasharray', `${progress}, 100`);

        // Add circles to SVG
        svg.appendChild(backgroundCircle);
        svg.appendChild(progressCircle);

        // Create progress text container
        const progressText = document.createElement('div');
        progressText.className = 'hud-progress-text';
        progressText.innerHTML = `
            <span class="progress-number">${votedPlayers}/${totalPlayers}</span>
            <span class="progress-label">Votes</span>
        `;

        // Add elements to progress container
        progressContainer.appendChild(svg);
        progressContainer.appendChild(progressText);

        // Add progress container to HUD
        hud.appendChild(progressContainer);

        // Add HUD to document
        document.body.appendChild(hud);
    }

    revealVotes() {
        if (this.ws.readyState === WebSocket.OPEN) {
            if (this.revealed) {
                // If votes are already revealed, start a new round
                this.resetRound();
            } else {
                // Otherwise, reveal the votes
                this.ws.send(JSON.stringify({
                    type: 'reveal'
                }));
            }
        }
    }

    resetRound() {
        if (this.ws.readyState === WebSocket.OPEN) {
            // Send reset message to server
            this.ws.send(JSON.stringify({
                type: 'reset'
            }));

            // Reset local state
            this.revealed = false;
            
            // Clear all player votes
            this.players.forEach(player => {
                player.vote = null;
            });

            // Clear selected cards
            if (this.cardsSection) {
                this.cardsSection.querySelectorAll('.card').forEach(card => {
                    card.classList.remove('selected');
                    // Remove any existing checkmark
                    const existingCheckmark = card.querySelector('.checkmark');
                    if (existingCheckmark) {
                        existingCheckmark.remove();
                    }
                });
            }

            // Hide results
            const results = document.querySelector('#results');
            if (results) {
                results.classList.add('hidden');
            }

            // Reset reveal button text
            if (this.revealButton) {
                this.revealButton.textContent = 'Reveal Votes';
            }

            // Update the UI to show all players as not voted
            this.updatePlayersList(Object.fromEntries(this.players), null);
        }
    }

    resetVotes() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'reset'
            }));
        }
    }

    showResults(players) {
        const votes = players
            .map(([_, player]) => player.vote)
            .filter(vote => vote !== null && vote !== undefined);
            
        if (votes.length === 0) return;

        const results = document.querySelector('#results');
        results.innerHTML = '';
        
        // Calculate statistics
        const numericVotes = votes.filter(vote => vote !== '?' && vote !== '∞');
        const average = numericVotes.length > 0 
            ? (numericVotes.reduce((a, b) => a + Number(b), 0) / numericVotes.length).toFixed(1)
            : 'N/A';
            
        const mode = this.calculateMode(votes);
        const finalVote = Math.round(Number(average)) || '?';
        
        // Calculate agreement percentage
        const agreementPercentage = this.calculateAgreement(votes);
        
        // Display results with new styling
        results.innerHTML = `
            <button class="close-button">×</button>
            <div class="results-container">
                <div class="final-vote">
                    <h2>Final Vote</h2>
                    <div class="vote-number">${finalVote}</div>
                </div>
                
                <div class="agreement-chart">
                    <div class="circular-progress">
                        <svg viewBox="0 0 36 36">
                            <path d="M18 2.0845
                                a 15.9155 15.9155 0 0 1 0 31.831
                                a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#eee"
                                stroke-width="3"
                            />
                            <path d="M18 2.0845
                                a 15.9155 15.9155 0 0 1 0 31.831
                                a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#4CAF50"
                                stroke-width="3"
                                stroke-dasharray="${agreementPercentage}, 100"
                            />
                        </svg>
                        <div class="agreement-text">
                            <span class="percentage">${agreementPercentage}%</span>
                            <span class="label">Agreement</span>
                        </div>
                    </div>
                </div>

                <div class="vote-distribution">
                    <h3>Vote Distribution</h3>
                    <div class="distribution-graph">
                        ${this.generateDistributionGraph(votes)}
                    </div>
                </div>

                <div class="stats-details">
                    <div class="stat-item">
                        <span class="label">Average</span>
                        <span class="value">${average}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Most Common</span>
                        <span class="value">${mode.join(', ')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">Total Votes</span>
                        <span class="value">${votes.length}</span>
                    </div>
                </div>

                <div class="votes-list">
                    ${votes.map(vote => `<span class="vote-item">${vote}</span>`).join(' ')}
                </div>
            </div>
        `;
        
        results.classList.remove('hidden');

        // Add click event for close button
        const closeButton = results.querySelector('.close-button');
        closeButton.addEventListener('click', () => {
            results.classList.add('hidden');
        });

        // Add click event for clicking outside
        results.addEventListener('click', (e) => {
            if (e.target === results) {
                results.classList.add('hidden');
            }
        });
        
        // Update reveal button text
        this.revealButton.textContent = 'Start New Round';
    }

    calculateAgreement(votes) {
        const numericVotes = votes.filter(vote => vote !== '?' && vote !== '∞');
        if (numericVotes.length === 0) return 0;

        const average = numericVotes.reduce((a, b) => a + Number(b), 0) / numericVotes.length;
        const variance = numericVotes.reduce((a, b) => a + Math.pow(Number(b) - average, 2), 0) / numericVotes.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Calculate agreement percentage (inverse of standard deviation)
        // Higher standard deviation = lower agreement
        const maxDeviation = 10; // Maximum expected deviation
        const agreement = Math.max(0, Math.min(100, 100 * (1 - standardDeviation / maxDeviation)));
        
        return Math.round(agreement);
    }

    generateDistributionGraph(votes) {
        const distribution = {};
        votes.forEach(vote => {
            distribution[vote] = (distribution[vote] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(distribution));
        const totalVotes = votes.length;

        return Object.entries(distribution)
            .map(([vote, count]) => {
                const percentage = (count / totalVotes) * 100;
                return `
                    <div class="bar-container">
                        <div class="bar" style="height: ${percentage}%">
                            <span class="bar-value">${count}</span>
                        </div>
                        <span class="bar-label">${vote}</span>
                    </div>
                `;
            })
            .join('');
    }

    handleGlobalClick(event) {
        // Check if click is on emoji selector or its children
        const selector = document.querySelector('.emoji-selector');
        const playerWrapper = event.target.closest('.player-wrapper');
        const emojiOption = event.target.closest('.emoji-option');
        
        // If click is on an emoji option, let the option's click handler handle it
        if (emojiOption) {
            return;
        }
        
        // If click is on a player wrapper, show emoji selector
        if (playerWrapper && !playerWrapper.classList.contains('current-user')) {
            const playerName = playerWrapper.querySelector('.player-name')?.textContent;
            const playerId = playerWrapper.dataset.playerId;
            if (playerName && playerId) {
                this.showEmojiSelector(event, { name: playerName, id: playerId });
            }
            return;
        }
        
        // If click is outside both selector and player wrapper, close selector
        if (selector && !selector.contains(event.target)) {
            selector.remove();
            this.emojiSelector = null; // Reset the selector reference
        }
    }

    showEmojiSelector(e, targetPlayer) {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove existing selector regardless of target
        if (this.emojiSelector) {
            this.emojiSelector.remove();
            this.emojiSelector = null;
        }

        // Create new selector
        this.emojiSelector = document.createElement('div');
        this.emojiSelector.className = 'emoji-selector';
        this.emojiSelector.dataset.targetPlayer = targetPlayer.name;
        this.emojiSelector.dataset.targetId = targetPlayer.id;
        
        // Add grid container for emojis
        const gridContainer = document.createElement('div');
        gridContainer.className = 'emoji-grid';
        
        // Add emoji options using the original set
        this.emojiOptions.forEach(emoji => {
            const option = document.createElement('div');
            option.className = 'emoji-option';
            option.textContent = emoji;
            
            option.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Find the current user's ID from the players map
                const currentUser = Array.from(this.players.entries())
                    .find(([_, player]) => player.isCurrentUser);
                
                if (currentUser && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const message = {
                        type: 'throwEmoji',
                        emoji: emoji,
                        targetId: targetPlayer.id,
                        sourceId: currentUser[0]
                    };
                    this.ws.send(JSON.stringify(message));
                    
                    // Handle the emoji throw locally for immediate feedback
                    this.handleEmojiThrown({
                        emoji: emoji,
                        source: currentUser[0],
                        target: targetPlayer.id
                    });
                }
                
                // Don't remove the selector after throwing, allow multiple throws
                return false;
            };
            
            gridContainer.appendChild(option);
        });
        
        this.emojiSelector.appendChild(gridContainer);

        // Find current user
        const currentUser = Array.from(this.players.entries())
            .find(([_, player]) => player.isCurrentUser);

        // Only show kick option if not targeting self
        if (currentUser && currentUser[0] !== targetPlayer.id) {
            // Add divider
            const divider = document.createElement('div');
            divider.className = 'emoji-selector-divider';
            this.emojiSelector.appendChild(divider);

            // Add kick option
            const kickOption = document.createElement('div');
            kickOption.className = 'kick-option';
            kickOption.innerHTML = '<span class="kick-icon">🗑️</span> Remove Player';
            
            kickOption.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                this.showKickConfirmation(targetPlayer, currentUser, () => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({
                            type: 'kickPlayer',
                            targetId: targetPlayer.id,
                            roomCode: this.roomCode,
                            sourceId: currentUser[0]
                        }));
                        
                        // Close the emoji selector
                        this.emojiSelector.remove();
                        this.emojiSelector = null;
                    }
                });
            };
            
            this.emojiSelector.appendChild(kickOption);
        }

        document.body.appendChild(this.emojiSelector);
        
        // Position the selector relative to the player
        const playerWrapper = e.currentTarget;
        const rect = playerWrapper.getBoundingClientRect();
        const selectorWidth = 200;
        const selectorHeight = 240; // Increased height to account for kick option
        
        // Get the center of the screen
        const centerX = window.innerWidth / 2;
        
        // Determine if player is on left or right half of the circle
        const isOnRightHalf = rect.left + (rect.width / 2) > centerX;
        
        // Calculate position based on which side of the circle the player is on
        let left;
        if (isOnRightHalf) {
            // Position selector to the right of the player
            left = rect.right + 10;
        } else {
            // Position selector to the left of the player
            left = rect.left - selectorWidth - 10;
        }
        
        // Calculate vertical position, centered with the player
        const top = rect.top + (rect.height - selectorHeight) / 2;
        
        // Adjust position if it would go off screen
        if (left < 10) {
            left = 10;
        } else if (left + selectorWidth > window.innerWidth - 10) {
            left = window.innerWidth - selectorWidth - 10;
        }
        
        if (top < 10) {
            top = 10;
        } else if (top + selectorHeight > window.innerHeight - 10) {
            top = window.innerHeight - selectorHeight - 10;
        }
        
        this.emojiSelector.style.left = `${left}px`;
        this.emojiSelector.style.top = `${top}px`;
    }

    calculateMode(votes) {
        const frequency = {};
        votes.forEach(vote => {
            frequency[vote] = (frequency[vote] || 0) + 1;
        });
        
        const maxFrequency = Math.max(...Object.values(frequency));
        return Object.keys(frequency).filter(vote => frequency[vote] === maxFrequency);
    }

    positionPlayerCards() {
        const players = Array.from(document.querySelectorAll('.player-card'));
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const radius = Math.min(window.innerWidth, window.innerHeight) * 0.35; // Adjusted radius for better spacing
        
        // Calculate the angle between each player
        const angleStep = (2 * Math.PI) / players.length;
        
        players.forEach((card, index) => {
            // Calculate position with offset to account for card size
            const angle = index * angleStep;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            // Position the card
            card.style.left = `${x - card.offsetWidth / 2}px`;
            card.style.top = `${y - card.offsetHeight / 2}px`;
            
            // Add a slight rotation to make cards face the center
            const rotation = (angle * 180 / Math.PI) + 90;
            card.style.transform = `rotate(${rotation}deg)`;
            
            // Add a subtle hover effect that lifts the card
            card.addEventListener('mouseenter', () => {
                card.style.transform = `rotate(${rotation}deg) translateY(-10px)`;
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.transform = `rotate(${rotation}deg)`;
            });
        });
    }

    updateRoomCode(roomCode) {
        if (roomCode) {
            this.roomCode = roomCode;
            this.roomCodeText.textContent = this.roomCode;
            
            // Show the room code div when we have a room code
            if (this.roomCodeDiv) {
                this.roomCodeDiv.classList.remove('hidden');
                this.roomCodeDiv.classList.add('compact');
                
                // Create or update user counter
                let userCounter = this.roomCodeDiv.querySelector('.user-counter');
                if (!userCounter) {
                    userCounter = document.createElement('div');
                    userCounter.className = 'user-counter';
                    this.roomCodeDiv.appendChild(userCounter);
                }
                userCounter.textContent = `${this.players.size} active`;
                
                // Update copy button text
                if (this.copyLinkButton) {
                    this.copyLinkButton.textContent = 'Copy';
                }
            }
            
            // Update URL with room code
            const url = new URL(window.location.href);
            url.searchParams.set('room', this.roomCode);
            window.history.replaceState({}, '', url);
        } else {
            this.roomCode = null;
            this.roomCodeText.textContent = '';
            if (this.roomCodeDiv) {
                this.roomCodeDiv.classList.add('hidden');
                this.roomCodeDiv.classList.remove('compact');
            }
            // Remove room code from URL
            const url = new URL(window.location.href);
            url.searchParams.delete('room');
            window.history.replaceState({}, '', url);
        }
    }

    updateVotingState(revealed) {
        // Only update if the state has actually changed
        if (revealed === this.revealed) {
            return;
        }
        
        this.revealed = revealed;
        
        if (!revealed) {
            // Hide results when starting new round
            const results = document.querySelector('#results');
            if (results) {
                results.classList.add('hidden');
            }
            // Only clear selected cards, don't clear votes
            this.cards.forEach(card => card.classList.remove('selected'));
        }
        
        this.revealButton.textContent = revealed ? 'Start New Round' : 'Reveal Votes';
        
        // Update all player cards to show/hide votes
        this.updatePlayersList(Object.fromEntries(this.players), null);
    }

    showErrorNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'player-join-notification error';
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove the notification after animation completes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    updateSummary(summary) {
        const summaryElement = document.getElementById('summary');
        if (summaryElement) {
            summaryElement.textContent = summary;
        }
    }

    generateRoomCode() {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        let code = '';
        for (let i = 0; i < 20; i++) {
            code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return code;
    }

    handleDeckTypeChange() {
        const selectedDeck = this.deckTypeSelect.value;
        
        // Show/hide custom input based on selection
        if (selectedDeck === 'custom') {
            this.customDeckInput.classList.remove('hidden');
            // Don't send any update to server until custom cards are submitted
            return;
        }
        
        this.customDeckInput.classList.add('hidden');
        
        // Update cards with preset deck
        const cards = this.presetDecks[selectedDeck];
        if (cards) {
            // Send the new card set to the server
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'updateCardSet',
                    cards: cards,
                    deckType: selectedDeck // This will be used to maintain the deck type
                }));
            }
        }
    }

    closeSettingsModal() {
        // Add a class to trigger the closing animation
        this.settingsModal.classList.add('hidden');
    }

    showKickConfirmation(targetPlayer, currentUser, callback) {
        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'kick-confirmation-modal';
        
        // Create modal content
        const content = document.createElement('div');
        content.className = 'kick-confirmation-content';
        
        // Add header
        const header = document.createElement('div');
        header.className = 'kick-confirmation-header';
        header.innerHTML = '<span class="warning-icon">⚠️</span> Community Moderation';
        
        // Add main text
        const text = document.createElement('div');
        text.className = 'kick-confirmation-text';
        text.textContent = `You are about to remove ${targetPlayer.name} from the game.`;
        
        // Add reasons section
        const reasons = document.createElement('div');
        reasons.className = 'kick-confirmation-reasons';
        reasons.innerHTML = `
            <ul>
                <li>Disruptive behavior</li>
                <li>Inappropriate conduct</li>
                <li>Inactive players</li>
            </ul>
        `;
        
        // Add buttons
        const buttons = document.createElement('div');
        buttons.className = 'kick-confirmation-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'kick-confirm-button cancel';
        cancelButton.textContent = 'Cancel';
        
        const confirmButton = document.createElement('button');
        confirmButton.className = 'kick-confirm-button confirm';
        confirmButton.textContent = 'Remove Player';
        
        buttons.appendChild(cancelButton);
        buttons.appendChild(confirmButton);
        
        // Assemble modal
        content.appendChild(header);
        content.appendChild(text);
        content.appendChild(reasons);
        content.appendChild(buttons);
        modal.appendChild(content);
        
        // Add to document
        document.body.appendChild(modal);
        
        // Force reflow to trigger animation
        modal.offsetHeight;
        modal.classList.add('visible');
        
        // Handle button clicks
        const closeModal = () => {
            modal.classList.remove('visible');
            setTimeout(() => modal.remove(), 300);
        };
        
        cancelButton.onclick = closeModal;
        
        confirmButton.onclick = () => {
            callback();
            closeModal();
        };
        
        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    showKickPopup() {
        // Create popup container
        const popup = document.createElement('div');
        popup.className = 'kick-popup';
        
        // Create popup content
        const content = document.createElement('div');
        content.className = 'kick-popup-content';
        
        // Add header
        const header = document.createElement('div');
        header.className = 'kick-popup-header';
        header.innerHTML = '<span class="warning-icon">⚠️</span> You have been removed from the room';
        
        // Add message
        const message = document.createElement('div');
        message.className = 'kick-popup-message';
        message.innerHTML = `
            <p>You have been removed from the room by another player.</p>
            <p>Please refresh the page to join a new room.</p>
        `;
        
        // Add refresh button
        const refreshButton = document.createElement('button');
        refreshButton.className = 'kick-popup-refresh';
        refreshButton.textContent = 'Refresh Page';
        refreshButton.onclick = () => window.location.reload();
        
        // Assemble popup
        content.appendChild(header);
        content.appendChild(message);
        content.appendChild(refreshButton);
        popup.appendChild(content);
        
        // Add to document
        document.body.appendChild(popup);
        
        // Force reflow to trigger animation
        popup.offsetHeight;
        popup.classList.add('visible');
    }

    resetGameState() {
        // Clear all game state
        this.players = new Map();
        this.revealed = false;
        this.currentCardSet = ['1', '2', '3', '5', '8', '13', '21', '?', '∞'];
        this.summary = '';
        
        // Reset UI elements
        if (this.cardsSection) {
            this.cardsSection.innerHTML = '';
            // Create new cards
            this.currentCardSet.forEach(value => {
                const card = document.createElement('div');
                card.className = 'card';
                card.dataset.value = value;
                card.textContent = value;
                this.cardsSection.appendChild(card);
            });
            // Attach event listeners to new cards
            this.attachCardEventListeners();
        }
        
        if (this.revealButton) {
            this.revealButton.textContent = 'Reveal Votes';
            this.revealButton.classList.remove('hidden');
        }
        
        // Clear any existing notifications
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => notification.remove());
    }

    // Add this method to show deck change notifications
    showDeckChangeNotification(deckType, changer) {
        // Format the deck name nicely
        const deckName = deckType === 'custom' 
            ? 'Custom'
            : deckType.split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

        const notification = document.createElement('div');
        notification.className = 'deck-change-notification';
        
        // Check if the changer is the current user
        const isCurrentUser = Object.entries(this.players)
            .find(([_, player]) => player.isCurrentUser && player.name === changer);
        
        const changerText = isCurrentUser ? 'You' : changer;
        notification.textContent = `${changerText} changed the deck to ${deckName}`;
        document.body.appendChild(notification);

        // Remove the notification after animation completes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    createPlayerCard(player) {
        const wrapper = document.createElement('div');
        wrapper.className = 'player-wrapper';
        wrapper.setAttribute('data-circle', '1');
        wrapper.setAttribute('data-player-id', player.id);

        const card = document.createElement('div');
        card.className = 'player-card';
        if (player.id === this.socket.id) {
            card.classList.add('current-user');
        }

        const voteIndicator = document.createElement('div');
        voteIndicator.className = 'vote-indicator not-voted';
        voteIndicator.textContent = '🤔';

        const nameContainer = document.createElement('div');
        nameContainer.className = 'name-container';

        const name = document.createElement('span');
        name.className = 'player-name';
        name.textContent = player.name;
        name.setAttribute('data-name', player.name);

        const youIndicator = document.createElement('span');
        youIndicator.className = 'you-indicator';
        youIndicator.textContent = 'You';

        nameContainer.appendChild(name);
        if (player.id === this.socket.id) {
            nameContainer.appendChild(youIndicator);
        }

        card.appendChild(voteIndicator);
        wrapper.appendChild(card);
        wrapper.appendChild(nameContainer);

        return wrapper;
    }

    updatePlayerCard(playerId, vote) {
        console.log('=== updatePlayerCard called ===');
        console.log('Parameters:', { playerId, vote });
        console.log('Current state:', {
            revealed: this.revealed,
            currentUserVote: Array.from(this.players.entries())
                .find(([_, player]) => player.isCurrentUser)?.[1]?.vote
        });

        const wrapper = document.querySelector(`.player-wrapper[data-player-id="${playerId}"]`);
        if (!wrapper) {
            console.log('No wrapper found for player:', playerId);
            return;
        }

        const voteIndicator = wrapper.querySelector('.vote-indicator');
        if (!voteIndicator) {
            console.log('No vote indicator found in wrapper');
            return;
        }

        // If votes are not revealed yet
        if (!this.revealed) {
            if (vote === null) {
                console.log('Setting not voted state (thinking face)');
                voteIndicator.textContent = '🤔';
                voteIndicator.className = 'vote-indicator not-voted';
            } else {
                console.log('Setting voted state (checkmark)');
                voteIndicator.textContent = '✓';
                voteIndicator.className = 'vote-indicator has-voted';
            }
        } else {
            console.log('Votes are revealed, showing actual vote');
            if (vote === null) {
                voteIndicator.textContent = '🤔';
                voteIndicator.className = 'vote-indicator not-voted';
            } else {
                voteIndicator.textContent = vote;
                voteIndicator.className = 'vote-indicator revealed';
            }
        }
    }

    updatePlayerTableRow(playerId, vote) {
        const row = document.querySelector(`.player-row[data-player-id="${playerId}"]`);
        if (!row) return;

        const status = row.querySelector('.status');
        if (!status) return;

        if (vote === null) {
            status.textContent = '🤔';
            status.className = 'status not-voted';
        } else if (vote === '?') {
            status.textContent = 'Voted';
            status.className = 'status';
        } else {
            status.textContent = 'Voted';
            status.className = 'status';
        }
    }

    handlePlayerLeft(message) {
        const username = message.username;
        if (this.players.has(username)) {
            this.players.delete(username);
            this.updatePlayersList();
            
            // If votes were in progress, we should update the UI to reflect the removed vote
            if (!this.revealed) {
                this.updateVoteCount();
            }
        }
    }
}

// Initialize the game
const game = new PlanningPoker(); 