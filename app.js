class PlanningPoker {
    constructor() {
        this.players = new Map();
        this.revealed = false;
        this.ws = null;
        this.roomCode = null;
        this.emojiSelector = null;
        this.emojiOptions = ['😊', '😂', '🤣', '😍', '😎', '🤔', '😴', '🤮', '💩', '🤡', '👻', '🤖'];
        this.currentCardSet = [];
        this.previousPlayers = new Set(); // Track previous players for join notifications
        this.isFirstState = true; // Track if this is the first state update
        this.init();
    }

    init() {
        // DOM elements
        this.usernameInput = document.getElementById('username');
        this.channelInput = document.getElementById('channel');
        this.joinButton = document.getElementById('join-button');
        this.joinContainer = document.querySelector('.join-container');
        this.gameContainer = document.querySelector('.game-container');
        this.roomCodeDiv = document.getElementById('room-code');
        this.playersList = document.getElementById('players-list');
        this.cardsSection = document.querySelector('.cards-section');
        this.cards = document.querySelectorAll('.card');
        this.revealButton = document.getElementById('reveal-button');
        this.resetButton = document.getElementById('reset-button');
        this.results = document.getElementById('results');
        this.connectionStatus = document.getElementById('connection-status');
        this.roomCodeText = document.getElementById('room-code-text');
        this.copyLinkButton = document.getElementById('copy-link');
        this.campfireContainer = document.querySelector('.campfire-container');
        this.customCardsInput = document.getElementById('custom-cards');
        this.updateCardsButton = document.getElementById('update-cards');

        // Event listeners
        if (this.joinButton) {
            this.joinButton.addEventListener('click', () => this.joinGame());
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
            setTimeout(() => {
                this.copyLinkButton.textContent = originalText;
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
            this.connectionStatus.textContent = 'Connected';
            this.connectionStatus.className = 'connected';
            
            // If we have pending join info, send it now
            if (this.pendingJoin) {
                this.ws.send(JSON.stringify({
                    type: 'join',
                    username: this.pendingJoin.username,
                    channel: this.pendingJoin.channel
                }));
                this.pendingJoin = null;
            }
        };

        this.ws.onclose = () => {
            this.connectionStatus.textContent = 'Disconnected';
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

            switch (message.type) {
                case 'channel_state':                    
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
            alert('Please enter at least one card value');
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

    handleEmojiThrown(message) {
        const targetCard = Array.from(document.querySelectorAll('.player-card'))
            .find(card => card.textContent.includes(message.target));
        
        if (targetCard) {
            const rect = targetCard.getBoundingClientRect();
            
            // Find the source player's card (the one who threw the emoji)
            const sourceCard = Array.from(document.querySelectorAll('.player-card'))
                .find(card => {
                    const name = card.querySelector('.player-name')?.textContent;
                    return name === message.source;
                });
            
            if (!sourceCard) {
                return;
            }
            
            const sourceRect = sourceCard.getBoundingClientRect();
            const sourceX = sourceRect.left + (sourceRect.width / 2);
            const sourceY = sourceRect.top + (sourceRect.height / 2);
            const targetX = rect.left + (rect.width / 2);
            const targetY = rect.top + (rect.height / 2);
            
            // Calculate the distance to travel
            const dx = targetX - sourceX;
            const dy = targetY - sourceY;

            // Create projectile with unique ID
            const projectileId = `projectile-${Date.now()}-${Math.random()}`;
            const projectile = document.createElement('div');
            projectile.className = 'emoji-projectile';
            projectile.id = projectileId;
            projectile.textContent = message.emoji;
            projectile.style.setProperty('--target-x', `${dx}px`);
            projectile.style.setProperty('--target-y', `${dy}px`);
            projectile.style.left = `${sourceX}px`;
            projectile.style.top = `${sourceY}px`;

            document.body.appendChild(projectile);

            // Remove projectile and show hit effect
            setTimeout(() => {
                const projectileElement = document.getElementById(projectileId);
                if (projectileElement) projectileElement.remove();

                // Create hit effect
                const hitId = `hit-${Date.now()}-${Math.random()}`;
                const hit = document.createElement('div');
                hit.className = 'emoji-hit';
                hit.id = hitId;
                hit.textContent = message.emoji;
                hit.style.left = `${targetX}px`;
                hit.style.top = `${targetY}px`;
                document.body.appendChild(hit);

                // Remove hit effect after animation
                setTimeout(() => {
                    const hitElement = document.getElementById(hitId);
                    if (hitElement) hitElement.remove();
                }, 500);
            }, 400);
        }
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
        if (!this.playersList) return;
        
        // Convert players object to Map for easier access
        this.players = new Map(Object.entries(players));
        
        // Clear existing player cards
        while (this.playersList.firstChild) {
            this.playersList.removeChild(this.playersList.firstChild);
        }
        
        const numPlayers = this.players.size;
        const radius = 200; // Distance from center
        let index = 0;
        
        this.players.forEach((player, name) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            // Add class for current user
            if (player.isCurrentUser) {
                playerCard.classList.add('current-user');
                playerCard.style.cursor = 'default'; // Ensure cursor is default for current user
            } else {
                // Add click handler for emoji shooter for other players only
                playerCard.addEventListener('click', (e) => {
                    // Double check that this is not the current user's card
                    if (!playerCard.classList.contains('current-user')) {
                        this.showEmojiSelector(e, { name });
                    }
                });
                playerCard.style.cursor = 'pointer';
            }
            
            // Calculate position in circle
            const angle = (index * (360 / numPlayers) - 90) * (Math.PI / 180);
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            
            playerCard.style.transform = `translate(${x}px, ${y}px)`;
            
            // Create name container for better styling
            const nameContainer = document.createElement('div');
            nameContainer.className = 'name-container';
            
            // Add name and (You) indicator if it's the current user
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = name;
            nameContainer.appendChild(nameSpan);
            
            if (player.isCurrentUser) {
                const youIndicator = document.createElement('span');
                youIndicator.className = 'you-indicator';
                youIndicator.textContent = ' (You)';
                nameContainer.appendChild(youIndicator);
            }
            
            const voteSpan = document.createElement('span');
            voteSpan.className = 'vote-indicator';
            
            // Show vote based on state
            if (player.vote !== null && player.vote !== undefined) {
                if (this.revealed) {
                    voteSpan.textContent = player.vote;
                    voteSpan.classList.add('revealed');
                } else {
                    voteSpan.textContent = '✓';
                    voteSpan.classList.add('has-voted');
                }
            } else {
                voteSpan.textContent = '...';
            }
            
            playerCard.appendChild(nameContainer);
            playerCard.appendChild(voteSpan);
            this.playersList.appendChild(playerCard);
            index++;
        });
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

    handleGlobalClick(e) {
        // Close emoji selector if clicking outside both the selector and any player card
        if (this.emojiSelector && 
            !this.emojiSelector.contains(e.target) && 
            !e.target.closest('.player-card')) {
            this.emojiSelector.remove();
            this.emojiSelector = null;
        }
    }

    showEmojiSelector(e, targetPlayer) {
        // Prevent throwing emojis at yourself
        const currentPlayerCard = Array.from(document.querySelectorAll('.player-card'))
            .find(card => card.textContent.includes('(You)'));
            
        if (currentPlayerCard && e.currentTarget === currentPlayerCard) {
            return;
        }

        e.stopPropagation();
        
        // If selector exists and is for the same target, keep it open
        if (this.emojiSelector && this.emojiSelector.dataset.targetPlayer === targetPlayer.name) {
            return;
        }

        // Remove existing selector if it's for a different target
        if (this.emojiSelector) {
            this.emojiSelector.remove();
        }

        // Create new selector
        this.emojiSelector = document.createElement('div');
        this.emojiSelector.className = 'emoji-selector';
        this.emojiSelector.dataset.targetPlayer = targetPlayer.name;
        
        // Add grid container for emojis
        const gridContainer = document.createElement('div');
        gridContainer.className = 'emoji-grid';
        this.emojiSelector.appendChild(gridContainer);
        
        // Get the clicked card's position (target position)
        const targetCard = e.currentTarget;
        const targetRect = targetCard.getBoundingClientRect();
        
        // Get the current user's card position (source position)
        const sourceRect = currentPlayerCard.getBoundingClientRect();
        
        // Calculate center points
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        const sourceX = sourceRect.left + sourceRect.width / 2;
        const sourceY = sourceRect.top + sourceRect.height / 2;
        
        // Calculate vector from source to target
        const vectorX = targetX - sourceX;
        const vectorY = targetY - sourceY;
        
        // Calculate the total distance and normalized direction
        const totalDistance = Math.sqrt(vectorX * vectorX + vectorY * vectorY);
        const dirX = vectorX / totalDistance;
        const dirY = vectorY / totalDistance;
        
        // Calculate the edge point of the card in the direction of the vector
        const halfWidth = targetRect.width / 2;
        const halfHeight = targetRect.height / 2;
        
        // Calculate intersection point with card edge
        let edgeX, edgeY;
        const absDirectionX = Math.abs(dirX);
        const absDirectionY = Math.abs(dirY);
        
        if (absDirectionX * halfHeight <= absDirectionY * halfWidth) {
            // Intersects with top/bottom edge
            edgeY = targetY + (dirY > 0 ? halfHeight : -halfHeight);
            edgeX = targetX + dirX * (halfHeight / absDirectionY);
        } else {
            // Intersects with left/right edge
            edgeX = targetX + (dirX > 0 ? halfWidth : -halfWidth);
            edgeY = targetY + dirY * (halfWidth / absDirectionX);
        }
        
        // Position the selector 5px from the edge point
        const selectorDistance = 5;
        const selectorX = edgeX + (dirX * selectorDistance);
        const selectorY = edgeY + (dirY * selectorDistance);
        
        // Position the selector, accounting for its new size (4 columns)
        const selectorWidth = 160;  // 4 emojis * 40px width
        const selectorHeight = 80; // 3 rows * 40px height (for 12 emojis)
        
        let left = selectorX - selectorWidth / 2;
        let top = selectorY - selectorHeight / 2;
        
        // Ensure the selector stays within viewport bounds
        left = Math.max(10, Math.min(window.innerWidth - selectorWidth - 10, left));
        top = Math.max(10, Math.min(window.innerHeight - selectorHeight - 10, top));
        
        this.emojiSelector.style.left = `${left}px`;
        this.emojiSelector.style.top = `${top}px`;

        // Add emoji options to the grid
        this.emojiOptions.forEach(emoji => {
            const option = document.createElement('div');
            option.className = 'emoji-option';
            option.textContent = emoji;
            
            option.onmousedown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.throwEmoji(emoji, targetPlayer);
            };
            
            gridContainer.appendChild(option);
        });

        this.emojiSelector.onclick = (e) => {
            e.stopPropagation();
        };

        document.body.appendChild(this.emojiSelector);
    }

    throwEmoji(emoji, targetPlayer) {
        // Send the emoji throw to the server first
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'throwEmoji',
                target: targetPlayer.name,
                emoji: emoji
            }));
        }
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
            this.roomCodeText.textContent = `Room: ${this.roomCode}`;
            this.roomCodeDiv.classList.remove('hidden');
            this.roomCodeDiv.classList.add('compact');
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
}

// Initialize the game
const game = new PlanningPoker(); 