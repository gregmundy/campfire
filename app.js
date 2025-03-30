class PlanningPoker {
    constructor() {
        this.players = new Map();
        this.revealed = false;
        this.ws = null;
        this.roomCode = null;
        this.emojiSelector = null;
        this.emojiOptions = ['😊', '😂', '🤣', '😍', '😎', '🤔', '😴', '💩', '🤡', '👻', '🤖', '📓', '❤️'];
        this.currentCardSet = [];
        this.previousPlayers = new Set(); // Track previous players for join notifications
        this.isFirstState = true; // Track if this is the first state update
        this.maxPlayers = 20; // Add max players limit
        this.presetDecks = {
            fibonacci: ['1', '2', '3', '5', '8', '13', '21', '?'],
            'modified-fibonacci': ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?'],
            't-shirt': ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '?'],
            powers: ['1', '2', '4', '8', '16', '32', '64', '?']
        };
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
            this.channelInput.value = roomCode.toUpperCase();
            this.roomCode = roomCode.toUpperCase();
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
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        // Store join info if we're trying to connect as part of joining
        this.pendingJoin = null;
        if (this.usernameInput?.value && this.channelInput?.value) {
            this.pendingJoin = {
                username: this.usernameInput.value.trim(),
                channel: this.channelInput.value.trim().toUpperCase()
            };
        }

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.connectionStatus.innerHTML = '<span>Connected</span>';
            this.connectionStatus.className = 'connected';
            
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
            this.connectionStatus.innerHTML = '<span>Disconnected</span>';
            this.connectionStatus.className = 'disconnected';
            
            // Try to reconnect after 2 seconds
            setTimeout(() => this.connectWebSocket(), 2000);
        };

        this.ws.onerror = () => {
            this.showErrorNotification('Connection error. Retrying...');
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
        const channel = this.channelInput.value.trim().toUpperCase();
        
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
            console.log('Received message:', message); // Add logging

            switch (message.type) {
                case 'roomCode':
                    this.channelInput.value = message.code;
                    break;
                case 'channel_state':                    
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
                        this.isFirstState = false;
                    }
                    
                    // Update selected card state based on your vote
                    if (message.players) {
                        const currentPlayer = Object.entries(message.players)
                            .find(([_, player]) => player.isCurrentUser);
                        
                        if (currentPlayer && this.cardsSection) {
                            // Clear all selected states first
                            this.cardsSection.querySelectorAll('.card').forEach(c => {
                                c.classList.remove('selected');
                                const existingCheckmark = c.querySelector('.checkmark');
                                if (existingCheckmark) {
                                    existingCheckmark.remove();
                                }
                            });
                            
                            // If the player has voted, find and select their card
                            if (currentPlayer[1].vote) {
                                const votedCard = Array.from(this.cardsSection.querySelectorAll('.card'))
                                    .find(card => card.dataset.value === currentPlayer[1].vote);
                                
                                if (votedCard) {
                                    votedCard.classList.add('selected');
                                    const checkmark = document.createElement('div');
                                    checkmark.className = 'checkmark';
                                    checkmark.innerHTML = '✓';
                                    votedCard.appendChild(checkmark);
                                }
                            }
                        }
                    }
                    
                    this.updatePlayersList(message.players);
                    this.updateRoomCode(message.roomCode);
                    this.updateVotingState(message.revealed);
                    
                    // Only show results if votes are revealed and this isn't a reset
                    if (message.revealed && message.players && this.revealButton.textContent !== 'Start New Round') {
                        const votes = Object.entries(message.players)
                            .map(([name, player]) => [name, player.vote])
                            .filter(([_, vote]) => vote !== null && vote !== undefined);
                        this.showResults(votes);
                    }
                    
                    if (message.cardSet && JSON.stringify(message.cardSet) !== JSON.stringify(this.currentCardSet)) {
                        this.currentCardSet = message.cardSet;
                        this.updateCardSetUI(message.cardSet);
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
                        return;
                    }
                    this.showErrorNotification(message.message);
                    break;
                default:
                    this.showErrorNotification('Unknown message type received');
            }
        } catch (error) {
            console.error('Error processing message:', error); // Add error logging
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

        // Check if the new card set is different from current
        if (JSON.stringify(values) === JSON.stringify(this.currentCardSet)) {
            return;
        }

        this.currentCardSet = values;
        this.updateCardSetUI(values);

        // Send the new card set to the server
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'updateCardSet',
                cards: values
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
        message.votes.forEach(([username, vote]) => {
            const player = this.players.get(username);
            if (player) {
                player.vote = vote;
            }
        });
        this.updatePlayersList();
        this.showResults(message.votes);
    }

    handleReset(message) {
        this.revealed = false;
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
        if (this.revealed) {
            this.showErrorNotification("Can't vote while votes are revealed");
            return;
        }
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showErrorNotification('Not connected to server. Reconnecting...');
            this.connectWebSocket();
            return;
        }
        
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
        
        // Add selected class and checkmark to clicked card
        card.classList.add('selected');
        
        // Create and add checkmark to the card
        const checkmark = document.createElement('div');
        checkmark.className = 'checkmark';
        checkmark.innerHTML = '✓';
        card.appendChild(checkmark);
        
        // Send vote to server
        try {
            this.ws.send(JSON.stringify({
                type: 'vote',
                vote: card.dataset.value
            }));
            
            // Update the player's own card in the circle immediately
            const playerCard = Array.from(document.querySelectorAll('.player-card'))
                .find(card => card.textContent.includes('(You)'));
            if (playerCard) {
                const voteSpan = playerCard.querySelector('span:last-child');
                if (voteSpan) {
                    voteSpan.textContent = '✓';
                    voteSpan.classList.add('has-voted');
                }
            }
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

    updatePlayersList(players) {
        // Convert players object to Map for easier access
        this.players = new Map(Object.entries(players));
        
        // Update user counter
        const userCounter = document.querySelector('.user-counter');
        if (userCounter) {
            userCounter.textContent = `${this.players.size} active`;
        }

        const playersList = document.querySelector('.players-circle');
        const campfireContainer = document.querySelector('.campfire-container');
        if (!playersList || !campfireContainer) return;

        // Clear existing players
        playersList.innerHTML = '';

        // First, find the current user
        const currentUserEntry = Array.from(this.players.entries())
            .find(([_, player]) => player.isCurrentUser);

        // Sort remaining players by ID (which correlates to join time)
        const otherPlayers = Array.from(this.players.entries())
            .filter(([_, player]) => !player.isCurrentUser)
            .sort(([idA], [idB]) => idA.localeCompare(idB));

        // Combine players: current user first, then others up to 9 more
        const circlePlayers = currentUserEntry ? [currentUserEntry] : [];
        circlePlayers.push(...otherPlayers.slice(0, 9));

        // Calculate positions for circle players
        const containerWidth = campfireContainer.offsetWidth;
        const containerHeight = campfireContainer.offsetHeight;
        const safeAreaTop = 60;
        const safeAreaBottom = 120;
        const usableHeight = containerHeight - safeAreaTop - safeAreaBottom;
        const usableWidth = containerWidth;
        const minDimension = Math.min(usableWidth, usableHeight);
        const centerX = containerWidth / 2;
        const centerY = (containerHeight - safeAreaBottom + safeAreaTop) / 2;
        const radius = minDimension * 0.45;

        // Calculate spacing
        const minSpacing = circlePlayers.length <= 6 ? 140 : 120;
        const circumference = 2 * Math.PI * radius;
        const spacing = circumference / circlePlayers.length;
        const finalRadius = spacing < minSpacing ? (minSpacing * circlePlayers.length) / (2 * Math.PI) : radius;

        // Create players in the circle
        circlePlayers.forEach(([id, player], index) => {
            const angle = (-Math.PI / 2) + (index * (2 * Math.PI / circlePlayers.length));
            const x = centerX + finalRadius * Math.cos(angle);
            const y = centerY + finalRadius * Math.sin(angle);
            
            const playerWrapper = document.createElement('div');
            playerWrapper.className = 'player-wrapper';
            playerWrapper.style.left = `${x}px`;
            playerWrapper.style.top = `${y}px`;
            playerWrapper.dataset.playerId = id;
            playerWrapper.dataset.circle = "1";

            if (!player.isCurrentUser) {
                playerWrapper.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showEmojiSelector(e, { name: player.name, id: id });
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
            voteIndicator.className = 'vote-indicator';
            if (player.vote !== null && player.vote !== undefined) {
                voteIndicator.classList.add('has-voted');
                if (this.revealed) {
                    voteIndicator.classList.add('revealed');
                    voteIndicator.textContent = player.vote;
                } else {
                    voteIndicator.textContent = '✓';
                }
            }

            const nameContainer = document.createElement('div');
            nameContainer.className = 'name-container';

            const playerName = document.createElement('span');
            playerName.className = 'player-name';
            playerName.textContent = player.name;

            const youIndicator = document.createElement('span');
            youIndicator.className = 'you-indicator';
            youIndicator.textContent = 'you';

            nameContainer.appendChild(playerName);
            if (player.isCurrentUser) {
                nameContainer.appendChild(youIndicator);
            }

            playerCard.appendChild(voteIndicator);
            playerWrapper.appendChild(playerCard);
            playerWrapper.appendChild(nameContainer);
            playersList.appendChild(playerWrapper);
        });

        // Handle additional players in table
        const tablePlayers = otherPlayers.slice(9);
        
        // Remove existing table if present
        const existingTable = document.querySelector('.additional-players-table');
        if (existingTable) {
            existingTable.remove();
        }

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
                        this.showEmojiSelector(e, { name: player.name, id: id });
                    });
                    playerRow.style.cursor = 'pointer';
                }

                const nameSpan = document.createElement('span');
                nameSpan.className = 'name';
                nameSpan.textContent = player.name + (player.isCurrentUser ? ' (You)' : '');

                const statusSpan = document.createElement('span');
                statusSpan.className = `status ${player.vote ? '' : 'waiting'}`;
                statusSpan.textContent = player.vote ? (this.revealed ? player.vote : '✓') : 'Waiting';

                playerRow.appendChild(nameSpan);
                playerRow.appendChild(statusSpan);
                tableGrid.appendChild(playerRow);
            });

            tableContainer.appendChild(tableGrid);
            document.body.appendChild(tableContainer);
        }
    }

    revealVotes() {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'reveal'
            }));
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
        document.body.appendChild(this.emojiSelector);
        
        // Position the selector at the center of the clicked player
        const playerWrapper = e.currentTarget;
        const rect = playerWrapper.getBoundingClientRect();
        const selectorWidth = 160;
        const selectorHeight = 120;
        
        // Calculate center position
        const left = rect.left + (rect.width - selectorWidth) / 2;
        const top = rect.top - selectorHeight - 10;
        
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
            this.roomCode = roomCode.toUpperCase();
            this.roomCodeText.textContent = this.roomCode;
            this.roomCodeDiv.classList.remove('hidden');
            this.roomCodeDiv.classList.add('compact');
            
            // Create or update user counter
            let userCounter = this.roomCodeDiv.querySelector('.user-counter');
            if (!userCounter) {
                userCounter = document.createElement('div');
                userCounter.className = 'user-counter';
                // Append to roomCodeDiv directly instead of using insertBefore
                this.roomCodeDiv.appendChild(userCounter);
            }
            userCounter.textContent = `${this.players.size} active`;
            
            // Update copy button text
            if (this.copyLinkButton) {
                this.copyLinkButton.textContent = 'Copy';
            }
            
            // Update URL with room code
            const url = new URL(window.location.href);
            url.searchParams.set('room', this.roomCode);
            window.history.replaceState({}, '', url);
        } else {
            this.roomCode = null;
            this.roomCodeText.textContent = '';
            this.roomCodeDiv.classList.add('hidden');
            this.roomCodeDiv.classList.remove('compact');
            // Remove room code from URL
            const url = new URL(window.location.href);
            url.searchParams.delete('room');
            window.history.replaceState({}, '', url);
        }
    }

    updateVotingState(revealed) {
        this.revealed = revealed;
        
        if (!revealed) {
            // Hide results when starting new round
            const results = document.querySelector('#results');
            if (results) {
                results.classList.add('hidden');
            }
            // Clear all votes and selected cards
            this.cards.forEach(card => card.classList.remove('selected'));
            this.players.forEach(player => {
                player.vote = null;
            });
        }
        
        this.revealButton.textContent = revealed ? 'Start New Round' : 'Reveal Votes';
        
        // Update all player cards to show/hide votes
        this.updatePlayersList(Object.fromEntries(this.players));
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'generateRoom'
            }));
        } else {
            this.showErrorNotification('Not connected to server');
        }
    }

    handleDeckTypeChange() {
        const selectedDeck = this.deckTypeSelect.value;
        
        // Show/hide custom input based on selection
        if (selectedDeck === 'custom') {
            this.customDeckInput.classList.remove('hidden');
            return;
        }
        
        this.customDeckInput.classList.add('hidden');
        
        // Update cards with preset deck
        const cards = this.presetDecks[selectedDeck];
        if (cards) {
            this.currentCardSet = cards;
            this.updateCardSetUI(cards);
            
            // Send the new card set to the server
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'updateCardSet',
                    cards: cards
                }));
            }
        }
    }

    closeSettingsModal() {
        // Add a class to trigger the closing animation
        this.settingsModal.classList.add('hidden');
    }
}

// Initialize the game
const game = new PlanningPoker(); 