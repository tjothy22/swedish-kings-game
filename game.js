// --- Constants ---
const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RANKS = ["4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]; // In value order for sorting ease
const RANK_VALUES = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    "J": 11, "Q": 12, "K": 13, "A": 14, "Joker": 0 // Joker value is special
};
const WILD_RANKS = ["2", "3", "Joker"];
const ACE_VALUE = 14;
const KING_VALUE = 13;
const QUEEN_VALUE = 12;
const ROYAL_VALUE_THRESHOLD = 11; // J, Q, K, A
const WILD_PENALTY = 5; // Increased penalty for using wilds
const STARTING_ROUND_LOW_WILD_PENALTY = 20; // Extra penalty for low wilds when starting round
const AI_TURN_DELAY = 1000; // Restored delay (1s) for standard AI turn
const ROUND_END_DELAY = AI_TURN_DELAY * 2; // Restored delay (2s) after AI wins a round with Aces
const STANDARD_ROUND_END_DELAY = AI_TURN_DELAY * 1.5; // Restored delay (1.5s) for normal round end
const LOW_CARD_THRESHOLD_P2 = 3; // Priority 2 Trigger (Stop Opponent)
const FALLING_BEHIND_DIFF_P4 = 5; // Priority 4 Trigger
const LEAVE_ONE_CARD_PENALTY = 50; // Large penalty for plays that leave exactly one card (unless Aces)
const AVG_SCORE_CATCHUP_THRESHOLD = 0.9; // Threshold for comparing avg scores (determines conservative trigger)
const ENDGAME_THRESHOLD = 6; // Hand size <= this enables end game planning logic & A/K priority
const ENDGAME_SINGLE_THRESHOLD = 2; // Hand size <= this, AI prioritizes lowest single if no other good play
const ENDGAME_UNNECESSARY_WILD_PENALTY = 15; // Penalty for using wilds unnecessarily in endgame
const PLAYER_AREA_IDS = ['human-player', 'computer-1', 'computer-2']; // Helper for IDs

// --- NEW: Computer Player Names ---
const COMPUTER_NAMES = [
    // Top ~50 Male Names 1900s (Source: SSA.gov)
    "John", "William", "James", "George", "Charles", "Robert", "Joseph", "Frank", "Edward", "Thomas",
    "Henry", "Walter", "Harry", "Willie", "Arthur", "Albert", "Clarence", "Fred", "Harold", "Paul",
    "Raymond", "Richard", "Roy", "Joe", "Louis", "Carl", "Ralph", "Earl", "Jack", "Ernest",
    "David", "Samuel", "Howard", "Charlie", "Francis", "Herbert", "Lawrence", "Theodore", "Alfred", "Andrew",
    "Elmer", "Sam", "Eugene", "Leo", "Michael", "Lee", "Herman", "Anthony", "Daniel", "Leonard",
    // Top ~50 Female Names 1900s (Source: SSA.gov)
    "Mary", "Helen", "Margaret", "Anna", "Ruth", "Elizabeth", "Dorothy", "Marie", "Florence", "Mildred",
    "Alice", "Ethel", "Lillian", "Gladys", "Edna", "Frances", "Rose", "Annie", "Grace", "Bertha",
    "Emma", "Bessie", "Clara", "Hazel", "Irene", "Gertrude", "Louise", "Catherine", "Martha", "Mabel",
    "Pearl", "Edith", "Esther", "Minnie", "Myrtle", "Ida", "Josephine", "Evelyn", "Elsie", "Eva",
    "Thelma", "Ruby", "Agnes", "Sarah", "Viola", "Nellie", "Beatrice", "Julia", "Laura", "Lillie"
];


// --- Game State (for playable game) ---
let gameState = {
    deck: [],
    players: [
        // Name for player 0 is fixed
        { id: 1, name: "You", hand: [] },
        // Computer names will be assigned in initializeGame
        { id: 2, name: "Computer 1", hand: [] },
        { id: 3, name: "Computer 2", hand: [] }
    ],
    currentPlayerIndex: -1, lastPlayedHand: null, passedPlayers: [], isGameOver: false, winner: null, isGameStarted: false, turnCount: 0, playedCards: {}
};
let selectedCards = [];

// --- Logging State (Persistent across games in session) ---
let gameCounter = 0;
let allGamesDetailedLog = [];
let currentGameDetailedLog = [];

// --- Card Creation ---
function createCard(suit, rank) { const isWild = WILD_RANKS.includes(rank); let dR = rank; let dS = suit ? SUIT_SYMBOLS[suit] : ''; let id = rank === "Joker" ? `Joker-${Math.random().toString(36).substr(2, 5)}` : `${rank}-${suit}`; if (rank === "Joker") { dR = "Joker"; dS = ""; } return { id: id, suit: suit, rank: rank, value: RANK_VALUES[rank], isWild: isWild, display: `${dR}${dS}` }; }
// --- Deck Functions ---
function createDeck() { const d = []; for (const s of SUITS) { for (let i = 4; i <= 14; i++) { let r; if (i <= 10) r = String(i); else if (i === 11) r = "J"; else if (i === 12) r = "Q"; else if (i === 13) r = "K"; else if (i === 14) r = "A"; d.push(createCard(s, r)); } d.push(createCard(s, "2")); d.push(createCard(s, "3")); } d.push(createCard(null, "Joker")); d.push(createCard(null, "Joker")); return d; }
function shuffleDeck(deck) { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; } }
// --- Dealing Function ---
function dealCards(deck, players) { let pI = 0; while (deck.length > 0) { const c = deck.pop(); if (c && players[pI]) players[pI].hand.push(c); pI = (pI + 1) % players.length; } players.forEach(p => sortHand(p.hand)); }
// --- Hand Sorting ---
function sortHand(hand) { hand.sort((a, b) => { const vA = a.value || 0; const vB = b.value || 0; if (vA !== vB) return vA - vB; const sO = { hearts: 1, diamonds: 2, clubs: 3, spades: 4, null: 5 }; return (sO[a.suit] || sO.null) - (sO[b.suit] || sO.null); }); }

// --- Hand Score Calculation (No longer needed for UI, but kept for AI logic) ---
function calculateHandRank(hand) { if (!hand || hand.length === 0) return 0; let score = 0; const rankCounts = {}; const basePoints = { A: 10, K: 8, Q: 6, J: 4, '10': 3, '9': 2, '8': 1 }; const wildPoints = { Joker: 5, '2': 4, '3': 4 }; for (const card of hand) { if (card.isWild) { score += wildPoints[card.rank] || 0; } else { score += basePoints[card.rank] || 0; rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1; } } for (const rank in rankCounts) { const count = rankCounts[rank]; const rankValue = RANK_VALUES[rank]; if (count >= 2) { score += (10 + Math.ceil(rankValue / 2)); } if (count >= 3) { score += (15 + rankValue); } if (count >= 4) { score += (15 + Math.ceil(rankValue * 1.5)); } } return score; }
// --- Helper: Calculate Average Score per Card (Used by AI) ---
function calculateAvgScore(hand) { if (!hand || hand.length === 0) return 0; const totalScore = calculateHandRank(hand); return totalScore / hand.length; }

// --- Rendering Functions ---
function renderCard(card) { const cE = document.createElement('div'); cE.classList.add('card'); cE.dataset.cardId = card.id; cE.textContent = card.display; cE.style.color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black'; if (card.rank === 'Joker') cE.style.fontWeight = 'bold'; return cE; }
function renderHands(players) {
    const isGameOver = gameState.isGameOver;
    const passedPlayerIndices = gameState.passedPlayers; // Get current passed players

    players.forEach((player, index) => {
        const isHuman = index === 0;
        let handElement;
        let countElementId;
        let playerAreaElement = document.getElementById(PLAYER_AREA_IDS[index]); // Get player area element
        let playerNameElement = playerAreaElement?.querySelector('h2'); // Find the h2 within the player area

        // Update player name in UI (for computer players)
        if (playerNameElement && player.name) {
             playerNameElement.textContent = player.name;
        }

        if (isHuman) {
            const wildsContainer = document.getElementById('p1-hand-wilds');
            const lowContainer = document.getElementById('p1-hand-low');
            const royalsContainer = document.getElementById('p1-hand-royals');
            const countElement = document.getElementById('p1-count');
            if (!wildsContainer || !lowContainer || !royalsContainer || !countElement) { console.error("HTML elements for grouped hand or card count not found for human player."); return; }
            wildsContainer.innerHTML = ''; lowContainer.innerHTML = ''; royalsContainer.innerHTML = '';
            sortHand(player.hand);
            player.hand.forEach(card => {
                const cardEl = renderCard(card);
                if (!isGameOver && !passedPlayerIndices.includes(index)) { // Player can only click if not game over AND not passed
                    cardEl.addEventListener('click', handleCardClick);
                    if (selectedCards.some(selectedCard => selectedCard.id === card.id)) { cardEl.classList.add('selected'); }
                } else { cardEl.style.cursor = 'default'; } // Make non-clickable otherwise
                if (card.isWild) { wildsContainer.appendChild(cardEl); }
                else if (card.value < ROYAL_VALUE_THRESHOLD) { lowContainer.appendChild(cardEl); }
                else { royalsContainer.appendChild(cardEl); }
            });
            countElement.textContent = player.hand.length;
        } else { // Computer players
            if (index === 1) { handElementId = 'c1-hand'; countElementId = 'c1-count'; }
            else { handElementId = 'c2-hand'; countElementId = 'c2-count'; }
            handElement = document.getElementById(handElementId);
            const countElement = document.getElementById(countElementId);
            if (!handElement || !countElement) { console.error(`HTML elements (hand/count) not found for player index ${index}`); return; }
            handElement.innerHTML = '';
            if (isGameOver && player.hand.length > 0) { // Reveal hand on game over
                sortHand(player.hand);
                player.hand.forEach(card => { const cardEl = renderCard(card); cardEl.style.cursor = 'default'; handElement.appendChild(cardEl); });
            } else if (!isGameOver) { // Show card backs during game
                player.hand.forEach(_ => { const cardEl=document.createElement('div'); cardEl.classList.add('card','card-back'); handElement.appendChild(cardEl); });
            }
            countElement.textContent = player.hand.length;
        }

        // Add/Remove visual state classes
        if (playerAreaElement) {
            // Winner state
            if (isGameOver && gameState.winner === index) {
                playerAreaElement.classList.add('player-wins');
            } else {
                playerAreaElement.classList.remove('player-wins');
            }
            // Passed state (only if game is not over)
            if (!isGameOver && passedPlayerIndices.includes(index)) {
                playerAreaElement.classList.add('player-passed');
            } else {
                playerAreaElement.classList.remove('player-passed');
            }
        } else {
             console.warn(`Player area element ${PLAYER_AREA_IDS[index]} not found for visual state update.`);
        }
    });
     // Update player highlight AFTER setting passed/winner states
     updatePlayerHighlight(gameState.currentPlayerIndex);
}
function renderPlayArea(playedHand) {
    const pAE = document.getElementById('last-played');
    if (!pAE) { console.error("Play area element ('last-played') not found."); return; }
    pAE.innerHTML = ''; // Clear previous cards first
    if (playedHand && playedHand.cards && playedHand.cards.length > 0) {
        sortHand(playedHand.cards);
        playedHand.cards.forEach(c => { const cE = renderCard(c); cE.style.cursor = 'default'; pAE.appendChild(cE); });
    }
}
function updateStatus(message) { const sE = document.getElementById('status-message'); if (sE) sE.textContent = message; else console.error("Status message element not found"); }
function logPlay(playerIndex, playedHand) { const logArea = document.getElementById('play-log'); if (!logArea) { console.error("Play log area not found"); return; } const playerName = gameState.players[playerIndex].name; sortHand(playedHand.cards); const cardDisplays = playedHand.cards.map(c => c.display).join(', '); const logEntry = document.createElement('div'); logEntry.classList.add('log-entry'); logEntry.textContent = `${playerName} played: ${cardDisplays}`; logArea.prepend(logEntry); }
function logEvent(message, type = 'info') { const logArea = document.getElementById('play-log'); if (!logArea) { console.error("Play log area not found"); return; } const logEntry = document.createElement('div'); logEntry.classList.add('log-entry', `log-event-${type}`); logEntry.textContent = `--- ${message} ---`; logArea.prepend(logEntry); }
function updatePlayerHighlight(currentPlayerIndex) {
    PLAYER_AREA_IDS.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) {
             // Only highlight if game is not over AND player has not passed
            if (i === currentPlayerIndex && !gameState.isGameOver && !gameState.passedPlayers.includes(i)) {
                 el.classList.add('current-player');
            } else {
                 el.classList.remove('current-player');
            }
        } else console.warn(`Player area element with ID ${id} not found.`);
    });
}

// --- Page Navigation ---
function showPage(pageIdToShow) { const pageIds = ['rules-page', 'game-page']; pageIds.forEach(id => { const element = document.getElementById(id); if (element) { element.style.display = (id === pageIdToShow) ? 'block' : 'none'; } }); window.scrollTo(0, 0); }

// --- Card Selection Logic ---
function handleCardClick(event) { if (gameState.isGameOver || gameState.passedPlayers.includes(0)) return; const cCE = event.target.closest('.card'); if (!cCE) return; const cId = cCE.dataset.cardId; if (!cId) { console.error("Clicked card element is missing data-card-id attribute."); return; } const cO = gameState.players[0].hand.find(c => c.id === cId); if (!cO) { console.error(`Card data not found in gameState for ID: ${cId}`); return; } cCE.classList.toggle('selected'); const isS = cCE.classList.contains('selected'); if (isS) { if (!selectedCards.some(c => c.id === cId)) selectedCards.push(cO); } else { selectedCards = selectedCards.filter(c => c.id !== cId); } console.log("Selected cards:", selectedCards.map(c => c.display).join(', ')); }

// --- Detailed Logging Function ---
function logDetailedTurn(actionType, details = {}) { const entry={gameId:gameCounter,turn:gameState.turnCount,playerIndex:gameState.currentPlayerIndex,playerName:gameState.players[gameState.currentPlayerIndex]?.name||'N/A',action:actionType,handSizeBefore:gameState.players[gameState.currentPlayerIndex]?.hand?.length||0,passedPlayersBefore:[...gameState.passedPlayers],lastPlayRank:gameState.lastPlayedHand?.rankValue||null,lastPlayQty:gameState.lastPlayedHand?.quantity||null,details:details};currentGameDetailedLog.push(entry); }

// --- Function to update played card counts ---
function trackPlayedCards(playedHand) { if (!playedHand || !playedHand.cards) return; for (const card of playedHand.cards) { if (!card.isWild) { const rank = card.rank; gameState.playedCards[rank] = (gameState.playedCards[rank] || 0) + 1; } } }

// --- Helper function to declare winner ---
function declareWinner(winnerIndex) { const winnerName = gameState.players[winnerIndex].name; updateStatus(`${winnerName} won!`); gameState.isGameOver = true; gameState.winner = winnerIndex; logDetailedTurn('game_end', { winner: winnerIndex }); allGamesDetailedLog.push(...currentGameDetailedLog); const playButton = document.getElementById('play-button'); const passButton = document.getElementById('pass-button'); if (playButton) playButton.disabled = true; if (passButton) passButton.disabled = true; updatePlayerHighlight(-1); renderHands(gameState.players); }

// --- Action Handlers ---
function validateSelectedCardsCombo(cardsToCheck) { if (!cardsToCheck || cardsToCheck.length === 0) return { isValid: false, message: "No cards selected." }; const nWCs = cardsToCheck.filter(c => !c.isWild); if (nWCs.length === 0) return { isValid: false, message: "Cannot play only wild cards." }; const fRV = nWCs[0].value; const aSR = nWCs.every(c => c.value === fRV); if (!aSR) return { isValid: false, message: "Selected cards must be the same rank (or wildcards)." }; return { isValid: true, rankValue: fRV, quantity: cardsToCheck.length }; }
function handlePlayAction() { console.log("Play button clicked."); if (gameState.isGameOver) { updateStatus("Game is over."); return; } if (gameState.currentPlayerIndex !== 0) { updateStatus("It's not your turn."); return; } if (gameState.passedPlayers.includes(0)) { updateStatus("You have passed for this round."); return; } const cV = validateSelectedCardsCombo(selectedCards); if (!cV.isValid) { updateStatus(`Invalid play: ${cV.message}`); return; } const { rankValue: rV, quantity: q } = cV; sortHand(selectedCards); const cP = { cards: [...selectedCards], rankValue: rV, quantity: q, playerIndex: 0 }; const lP = gameState.lastPlayedHand; if (!gameState.isGameStarted) { if (!lP) { if (!selectedCards.some(c => c.rank === '4' && c.suit === 'hearts')) { updateStatus("Invalid play: First play must include the 4 of Hearts."); return; } gameState.isGameStarted = true; console.log("First play (4♥) is valid."); } else { console.error("Error: Game not started but lastPlayedHand exists."); return; } } else if (lP) { if (!(cP.rankValue > lP.rankValue && cP.quantity >= lP.quantity)) { updateStatus(`Invalid play: Must play higher rank (${cP.rankValue} vs ${lP.rankValue}) with at least same quantity (${cP.quantity} vs ${lP.quantity}).`); return; } console.log("Mid-round play is valid against last hand."); } else { console.log("First play of a new round is valid."); } const isWH = gameState.players[0].hand.length === selectedCards.length; if (isWH) { if (selectedCards.some(c => c.value === ACE_VALUE || c.isWild)) { updateStatus("Invalid play: Final hand cannot contain Aces or Wildcards."); return; } console.log("Valid winning hand detected!"); } console.log(`Play confirmed: ${cP.quantity} cards of rank value ${cP.rankValue}`); logDetailedTurn('play', { cards: cP.cards.map(c => c.display).join(';'), rank: cP.rankValue, qty: cP.quantity, wilds: cP.cards.some(c => c.isWild), style: 'human' }); gameState.lastPlayedHand = cP; trackPlayedCards(cP); const playedCardIds = selectedCards.map(card => card.id); gameState.players[0].hand = gameState.players[0].hand.filter(card => !playedCardIds.includes(card.id)); selectedCards = []; logPlay(0, cP); renderPlayArea(gameState.lastPlayedHand); renderHands(gameState.players); if (gameState.players[0].hand.length === 0) { declareWinner(0); return; } if (cP.rankValue === ACE_VALUE) { console.log(">>> handlePlayAction: Processing Ace play round win."); logEvent("Aces played - Round Over!", "round-end"); logDetailedTurn('round_end', { reason: 'ace', winner: 0 }); updateStatus("Aces played! **You won the round!** Starting next..."); setTimeout(() => { console.log(">>> handlePlayAction: Timeout executing startNextRound for Ace play."); startNextRound(0); }, ROUND_END_DELAY); return; } updateStatus("Play successful. Advancing turn..."); advanceTurn(); }
function handlePassAction() { console.log("Pass button clicked."); if (gameState.isGameOver) { updateStatus("Game is over."); return; } if (gameState.currentPlayerIndex !== 0) { updateStatus("It's not your turn."); return; } if (gameState.passedPlayers.includes(0)) { updateStatus("You have already passed for this round."); return; } if (!gameState.isGameStarted) { updateStatus("Cannot pass before the first card (4♥) is played."); return; } if (!gameState.lastPlayedHand || gameState.lastPlayedHand.playerIndex === 0) { updateStatus("Cannot pass when you start the round or just played."); return; } const playerIndex = gameState.currentPlayerIndex; const playerName = gameState.players[playerIndex].name; if (!gameState.passedPlayers.includes(playerIndex)) { logDetailedTurn('pass', { reason: 'manual' }); gameState.passedPlayers.push(playerIndex); console.log(`Player ${playerIndex} (${playerName}) passed. Passed players: [${gameState.passedPlayers.join(', ')}]`); logEvent(`${playerName} passed.`, 'pass'); } else { console.log(`Player ${playerIndex} (You) already passed this round.`); } selectedCards = []; renderHands(gameState.players); console.log(">>> handlePassAction: Checking round over..."); if (checkRoundOver()) { const roundWinnerIndex = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1; if (roundWinnerIndex !== -1) { const winnerName = gameState.players[roundWinnerIndex].name; console.log(`>>> handlePassAction: Round over! Winner: Player ${roundWinnerIndex}. Scheduling startNextRound.`); logEvent(`${winnerName} wins the round (opponents passed).`, 'round-end'); logDetailedTurn('round_end', { reason: 'pass', winner: roundWinnerIndex }); updateStatus(`Round over! ${winnerName} wins the round. Starting next...`); setTimeout(() => { console.log(`>>> handlePassAction: Timeout executing startNextRound for pass win.`); startNextRound(roundWinnerIndex); }, STANDARD_ROUND_END_DELAY); } else { console.error("Round over, but couldn't determine winner!"); advanceTurn(); } } else { updateStatus("You passed. Advancing turn..."); advanceTurn(); } }

// --- AI Logic ---

// --- *** CORRECTED findValidPlays function *** ---
function findValidPlays(hand, lastPlayedHand, isGameStartedSim = gameState.isGameStarted) {
    const validPlays = [];
    if (!hand || hand.length === 0) return validPlays;

    const availableWilds = hand.filter(c => c.isWild);
    const nonWildsGroupedByRank = hand.filter(c => !c.isWild).reduce((acc, c) => {
        if (!acc[c.rank]) acc[c.rank] = [];
        acc[c.rank].push(c);
        return acc;
    }, {});

    const lastRankValue = lastPlayedHand?.rankValue ?? -1;
    const minQuantityNeeded = lastPlayedHand?.quantity ?? 1; // Minimum quantity to play

    // Iterate through each rank the player holds (non-wilds)
    for (const rank in nonWildsGroupedByRank) {
        const nonWildCardsOfRank = nonWildsGroupedByRank[rank];
        const rankValue = nonWildCardsOfRank[0].value;

        // Check if this rank can beat the last played rank
        if (lastPlayedHand && rankValue <= lastRankValue) {
            continue; // This rank is too low, skip
        }

        const numNonWilds = nonWildCardsOfRank.length;
        const maxPossibleQuantity = numNonWilds + availableWilds.length;

        // Iterate through possible quantities for this rank, starting from the minimum needed
        for (let quantity = minQuantityNeeded; quantity <= maxPossibleQuantity; quantity++) {

            // Determine how many non-wilds and wilds to USE for this specific quantity
            const numNonWildsToUse = Math.min(quantity, numNonWilds);
            const wildsNeeded = quantity - numNonWildsToUse;

            // Check if enough wild cards are available in the hand
            if (wildsNeeded >= 0 && wildsNeeded <= availableWilds.length) {
                // Construct the play using the calculated numbers
                const playCards = [
                    ...nonWildCardsOfRank.slice(0, numNonWildsToUse), // Use calculated non-wilds
                    ...availableWilds.slice(0, wildsNeeded)         // Use calculated wilds needed
                ];

                // Safety check: ensure the constructed hand has the target quantity
                if (playCards.length !== quantity) {
                     console.error(`Logic error in findValidPlays: Constructed ${playCards.length} cards for quantity ${quantity} (Rank: ${rank}, NonWilds: ${numNonWildsToUse}, Wilds: ${wildsNeeded})`);
                     continue; // Skip this invalid construction
                }

                const potentialPlay = {
                    cards: playCards,
                    rankValue: rankValue,
                    quantity: quantity,
                    usesWilds: wildsNeeded > 0
                };

                // Final validation using isPlayValidVsLast (checks rank and quantity >= last)
                if (isPlayValidVsLast(potentialPlay, lastPlayedHand)) {
                    validPlays.push(potentialPlay);
                }
            }
        }
    }

    // Special check for the 4 of Hearts start
    if (!isGameStartedSim && !lastPlayedHand) {
        return validPlays.filter(p => p.cards.some(c => c.rank === '4' && c.suit === 'hearts'));
    }

    return validPlays;
}


function isPlayValidVsLast(potentialPlay, lastPlayedHand) {
    if (!lastPlayedHand) return true; // Any play is valid if nothing has been played
    // Must be higher rank AND quantity must be >= last played quantity
    return potentialPlay.rankValue > lastPlayedHand.rankValue && potentialPlay.quantity >= lastPlayedHand.quantity;
}

// --- AI Helper Functions ---
function getRemainingHand(currentHand, playToMake) { const playedCardIds = new Set(playToMake.cards.map(c => c.id)); return currentHand.filter(card => !playedCardIds.has(card.id)); }
function countDistinctNonWildRanks(hand) { const ranks = new Set(); hand.forEach(card => { if (!card.isWild) { ranks.add(card.rank); } }); return ranks.size; }
function getNonWildCardsByRank(hand) { return hand.filter(c => !c.isWild).reduce((acc, c) => { if (!acc[c.rank]) acc[c.rank] = []; acc[c.rank].push(c); return acc; }, {}); }
function findHighestNonWildCardId(hand) { let highestValue = -1; let highestId = null; hand.forEach(card => { if (!card.isWild && card.value > highestValue) { highestValue = card.value; highestId = card.id; } }); return highestId; }
function findLowestNonWildCardId(hand) { let lowestValue = Infinity; let lowestId = null; hand.forEach(card => { if (!card.isWild && card.value < lowestValue) { lowestValue = card.value; lowestId = card.id; } }); return lowestId; }

// --- chooseBestPlay Function ---
function chooseBestPlay(validPlays, playerIndex) {
    if (!validPlays || validPlays.length === 0) { console.log(`AI-${playerIndex}: No valid plays possible.`); return { chosenPlay: null, playStyle: 'pass_no_valid' }; }
    const aiPlayer = gameState.players[playerIndex]; const aiHand = aiPlayer.hand; const lastPlayedHand = gameState.lastPlayedHand; const lastRankValue = lastPlayedHand?.rankValue ?? -1; const aiHandLength = aiHand.length; let playStyle = 'default';

    // --- Priority 1: Winning Play --- (Unaffected by wildcard minimization logic)
    const winningPlays = validPlays.filter(play => play.quantity === aiHandLength && !play.cards.some(c => c.value === ACE_VALUE || c.isWild));
    if (winningPlays.length > 0) { playStyle = 'winning'; console.log(`AI-${playerIndex}: Priority 1 (${playStyle}): Found valid winning play!`); sortHand(winningPlays[0].cards); return { chosenPlay: winningPlays[0], playStyle: playStyle }; }

    let minOpponentHandSize = Infinity; let leadingPlayerHandSize = Infinity; let totalOpponentCards = 0; let opponentCount = 0; let opponentAvgScores = [];
    gameState.players.forEach((player, index) => { if (index !== playerIndex) { opponentCount++; const oppHandLength = player.hand.length; totalOpponentCards += oppHandLength; minOpponentHandSize = Math.min(minOpponentHandSize, oppHandLength); leadingPlayerHandSize = Math.min(leadingPlayerHandSize, oppHandLength); opponentAvgScores.push(calculateAvgScore(player.hand)); } });
    const avgOpponentHandLength = opponentCount > 0 ? totalOpponentCards / opponentCount : 0; const myAvgScore = calculateAvgScore(aiHand); const tableAvgScore = opponentCount > 0 ? opponentAvgScores.reduce((a, b) => a + b, 0) / opponentCount : 0;

    // --- Priority 3: Penultimate Play Setup --- (Unaffected by wildcard minimization logic)
    const nonWildCardsByRank = getNonWildCardsByRank(aiHand); const distinctRankCount = Object.keys(nonWildCardsByRank).length;
    if (distinctRankCount === 2) {
        playStyle = 'penultimate'; console.log(`AI-${playerIndex}: Priority 3 (${playStyle}): Found 2 distinct non-wild ranks.`);
        const ranks = Object.keys(nonWildCardsByRank); const rankValue1 = RANK_VALUES[ranks[0]]; const rankValue2 = RANK_VALUES[ranks[1]];
        const higherRank = rankValue1 > rankValue2 ? ranks[0] : ranks[1]; const lowerRank = rankValue1 < rankValue2 ? ranks[0] : ranks[1];
        const higherRankCards = nonWildCardsByRank[higherRank]; const lowerRankCards = nonWildCardsByRank[lowerRank];
        const wildCards = aiHand.filter(c => c.isWild);

        const playAttemptHigher = { cards: [...higherRankCards, ...wildCards], rankValue: RANK_VALUES[higherRank], quantity: higherRankCards.length + wildCards.length, usesWilds: wildCards.length > 0 };
        if (isPlayValidVsLast(playAttemptHigher, lastPlayedHand)) { console.log(`AI-${playerIndex}: (${playStyle}) Constructed play (higher rank + wilds) is valid.`); sortHand(playAttemptHigher.cards); return { chosenPlay: playAttemptHigher, playStyle: playStyle }; }

        const playAttemptLower = { cards: [...lowerRankCards, ...wildCards], rankValue: RANK_VALUES[lowerRank], quantity: lowerRankCards.length + wildCards.length, usesWilds: wildCards.length > 0 };
         if (isPlayValidVsLast(playAttemptLower, lastPlayedHand)) { console.log(`AI-${playerIndex}: (${playStyle}) Constructed play (lower rank + wilds) is valid.`); sortHand(playAttemptLower.cards); return { chosenPlay: playAttemptLower, playStyle: `${playStyle}_lower_rank` }; }

        console.log(`AI-${playerIndex}: (${playStyle}) Neither constructed penultimate play was valid.`);
    }

    // --- Priority 2: Stop Opponent Winning --- (Uses plays with minimal wilds)
    if (minOpponentHandSize <= LOW_CARD_THRESHOLD_P2) {
        playStyle = 'stop_opponent'; console.log(`AI-${playerIndex}: Priority 2 (${playStyle}): Opponent has <= ${LOW_CARD_THRESHOLD_P2} cards. Playing highest score.`);
        let P2Candidates = [...validPlays];
        P2Candidates.sort((a, b) => { let scoreA = a.rankValue - (a.usesWilds ? WILD_PENALTY : 0); let scoreB = b.rankValue - (b.usesWilds ? WILD_PENALTY : 0); if (scoreA !== scoreB) return scoreB - scoreA; if (a.quantity !== b.quantity) return b.quantity - a.quantity; return b.rankValue - a.rankValue; }); // Highest score, then quantity, then rank
        if (P2Candidates.length > 0) { sortHand(P2Candidates[0].cards); return { chosenPlay: P2Candidates[0], playStyle: playStyle }; }
        console.log(`AI-${playerIndex}: (${playStyle}) No valid plays found.`); return { chosenPlay: null, playStyle: `pass_${playStyle}` };
    }

    // --- Priority 4: Falling Behind --- (Uses plays with minimal wilds)
    if (aiHandLength >= leadingPlayerHandSize + FALLING_BEHIND_DIFF_P4) {
        playStyle = 'falling_behind'; console.log(`AI-${playerIndex}: Priority 4 (${playStyle}): Hand size ${aiHandLength} >= Leader size ${leadingPlayerHandSize} + ${FALLING_BEHIND_DIFF_P4}.`);
        let P4Candidates = validPlays.filter(p => lastRankValue === -1 || p.rankValue <= lastRankValue + 5);
        console.log(`AI-${playerIndex}: (${playStyle}) Found ${P4Candidates.length} plays within 5 ranks.`);

        // Sort: lowest rank first, then HIGHEST quantity (to dump cards), then fewest wilds
        P4Candidates.sort((a,b) => {
             if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; // Lowest rank
             if (a.quantity !== b.quantity) return b.quantity - a.quantity; // Highest quantity
             const wildsA = a.cards.filter(c => c.isWild).length;
             const wildsB = b.cards.filter(c => c.isWild).length;
             return wildsA - wildsB; // Fewest wilds as tie-breaker
        });

        if (P4Candidates.length > 0) {
             let chosenP4 = P4Candidates[0];
             let p4Style = `${playStyle}${chosenP4.usesWilds ? '_with_wilds' : '_no_wilds'}`;
             console.log(`AI-${playerIndex}: (${playStyle}) Playing lowest rank, highest quantity play (<=+5). Style: ${p4Style}`);
             sortHand(chosenP4.cards);
             return { chosenPlay: chosenP4, playStyle: p4Style };
        }

        console.log(`AI-${playerIndex}: (${playStyle}) No suitable plays found within 5 ranks. Passing.`); return { chosenPlay: null, playStyle: `pass_${playStyle}` };
    }

    // --- Helper function for P5/P6 filtering & sorting --- *** USES NEW SORT ORDER ***
    const filterAndSortLowestP5P6 = (candidates, rankLimit, royalLimit, avoidHighestId, lowestCardIdInHand) => {
        let filtered = candidates.filter(play => {
            const rankCheck = lastRankValue === -1 || play.rankValue <= lastRankValue + rankLimit;
            const highestCheck = avoidHighestId === null ||
                                 play.cards.some(c => c.id === lowestCardIdInHand) ||
                                 !play.cards.some(c => c.id === avoidHighestId);
            const royalCheck = !(lastRankValue >= QUEEN_VALUE && play.rankValue > lastRankValue + royalLimit);
            return rankCheck && highestCheck && royalCheck;
        });

        if (filtered.length > 0) {
            // *** NEW SORT ORDER: 1. Rank (Lowest), 2. Wilds (Fewest), 3. Quantity (Highest) ***
            filtered.sort((a,b) => {
                 if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; // 1. Rank (Asc)
                 const wildsA = a.cards.filter(c => c.isWild).length;
                 const wildsB = b.cards.filter(c => c.isWild).length;
                 if (wildsA !== wildsB) return wildsA - wildsB; // 2. Wilds (Asc)
                 return b.quantity - a.quantity; // 3. Quantity (Desc)
            });
            return filtered;
        }
        return null;
    };

    const highestCardId = findHighestNonWildCardId(aiHand);
    const lowestCardId = findLowestNonWildCardId(aiHand);
    const lowestCardRank = lowestCardId ? RANK_VALUES[aiHand.find(c=>c.id===lowestCardId)?.rank] : null;

    // --- Priority 5: Confident --- (Uses new sort order)
    if (myAvgScore >= tableAvgScore) {
        playStyle = 'confident'; console.log(`AI-${playerIndex}: Priority 5 (${playStyle}): Avg Score ${myAvgScore.toFixed(1)} >= Table Avg ${tableAvgScore.toFixed(1)}.`);
        let P5Choice = null;
        let filteredList = filterAndSortLowestP5P6(validPlays, 4, 2, highestCardId, lowestCardId); // Rank <=+4, Royal <=+2

        if (filteredList) {
            console.log(`AI-${playerIndex}: (${playStyle}) Found ${filteredList.length} suitable plays (rank<=+4, royal<=+2, avoid highest or is lowest). Sorted by rank, then wilds, then quantity.`);
            P5Choice = filteredList[0];
            playStyle = `${playStyle}${P5Choice.usesWilds ? '_with_wilds' : '_no_wilds'}`;

            const startingRound = !lastPlayedHand; const holdingAce = aiHand.some(c => c.rank === 'A');
            const lowestIsSingle = P5Choice.rankValue === lowestCardRank && P5Choice.quantity === 1;
            if (startingRound && holdingAce && lowestIsSingle) {
                console.log(`AI-${playerIndex}: (${playStyle}) Applying Ace Start + Lowest Single rule.`);
                const secondBestPlay = filteredList.length > 1 ? filteredList[1] : null;
                if (secondBestPlay) { console.log(`AI-${playerIndex}: (${playStyle}) Found second best play. Switching choice.`); P5Choice = secondBestPlay; playStyle += '_ace_start_swap'; }
                else { console.log(`AI-${playerIndex}: (${playStyle}) Lowest was single, but no second best play found. Sticking with lowest.`); }
            }
            sortHand(P5Choice.cards); return { chosenPlay: P5Choice, playStyle: playStyle };
        }
        console.log(`AI-${playerIndex}: (${playStyle}) No suitable plays found within confident limits. Passing.`); return { chosenPlay: null, playStyle: `pass_${playStyle}` };
    }
    // --- Priority 6: Conservative --- (Uses new sort order)
    else {
        playStyle = 'conservative'; console.log(`AI-${playerIndex}: Priority 6 (${playStyle}): Avg Score ${myAvgScore.toFixed(1)} < Table Avg ${tableAvgScore.toFixed(1)}.`);
        let P6Choice = null;
        let filteredList = filterAndSortLowestP5P6(validPlays, 2, 1, highestCardId, lowestCardId); // Rank <=+2, Royal <=+1

         if (filteredList) {
            console.log(`AI-${playerIndex}: (${playStyle}) Found ${filteredList.length} suitable plays (rank<=+2, royal<=+1, avoid highest or is lowest). Sorted by rank, then wilds, then quantity.`);
            P6Choice = filteredList[0];
            playStyle = `${playStyle}${P6Choice.usesWilds ? '_with_wilds' : '_no_wilds'}`;

             const startingRound = !lastPlayedHand; const holdingAce = aiHand.some(c => c.rank === 'A');
             const isLowestRankPlay = P6Choice.rankValue === lowestCardRank; const isSinglePlay = P6Choice.quantity === 1;
             if (startingRound && holdingAce && isLowestRankPlay && isSinglePlay) {
                 console.log(`AI-${playerIndex}: (${playStyle}) Applying Ace Start + Lowest Single rule.`);
                 const secondBestPlay = filteredList.length > 1 ? filteredList[1] : null;
                 if (secondBestPlay) { console.log(`AI-${playerIndex}: (${playStyle}) Found second best play. Switching choice.`); P6Choice = secondBestPlay; playStyle += '_ace_start_swap'; }
                 else { console.log(`AI-${playerIndex}: (${playStyle}) Lowest was single, but no second best play found. Sticking with lowest.`); }
             }
             sortHand(P6Choice.cards); return { chosenPlay: P6Choice, playStyle: playStyle };
         }
         console.log(`AI-${playerIndex}: (${playStyle}) No suitable plays found within conservative limits. Passing.`); return { chosenPlay: null, playStyle: `pass_${playStyle}` };
    }
} // End chooseBestPlay


function shouldAIPassStrategically(chosenPlay, gameState, playerIndex, playStyle) {
     if (playStyle.startsWith('pass_') || playStyle === 'stop_opponent' || playStyle.startsWith('penultimate')) { return false; }
     let minOpponentHandSize = Infinity;
     for (let i = 0; i < gameState.players.length; i++) { if (i !== playerIndex) { minOpponentHandSize = Math.min(minOpponentHandSize, gameState.players[i].hand.length); } }
     const aiHandSize = gameState.players[playerIndex].hand.length;
     if (minOpponentHandSize <= LOW_CARD_THRESHOLD_P2 || aiHandSize <= ENDGAME_THRESHOLD) { return false; }
     if (chosenPlay.rankValue >= KING_VALUE && (!gameState.lastPlayedHand || gameState.lastPlayedHand.rankValue < QUEEN_VALUE)) { console.log(`AI-${playerIndex}: (${playStyle}) Strategic Pass considered: Play uses K/A unnecessarily.`); return true; }
     if (chosenPlay.usesWilds && chosenPlay.quantity === 2 && chosenPlay.rankValue < QUEEN_VALUE) { console.log(`AI-${playerIndex}: (${playStyle}) Strategic Pass considered: Play uses wild(s) for low double.`); return true; }
     return false;
 }

 function handleAITurn(playerIndex) {
    const playerName = gameState.players[playerIndex].name; const playerHand = gameState.players[playerIndex].hand;
    console.log(`--- AI Turn Start: ${playerName} (Index: ${playerIndex}) ---`); console.log(`Current passedPlayers: [${gameState.passedPlayers.join(', ')}]`); gameState.turnCount++;

    if (!gameState.isGameStarted && playerHand.some(card => card.rank === '4' && card.suit === 'hearts')) {
        console.log(`AI (${playerName}) needs to play 4♥.`); let fourHPlay = null;
        const plays = findValidPlays(playerHand, null);
        fourHPlay = plays.find(p => p.cards.some(c => c.rank === '4' && c.suit === 'hearts'));

        if (fourHPlay) {
             console.log(`AI (${playerName}) chose to play 4♥ combo:`, fourHPlay.cards.map(c=>c.display));
             logDetailedTurn('play', { cards: fourHPlay.cards.map(c => c.display).join(';'), rank: fourHPlay.rankValue, qty: fourHPlay.quantity, wilds: fourHPlay.usesWilds, style: 'start_4h' });
             gameState.lastPlayedHand = { ...fourHPlay, playerIndex: playerIndex }; trackPlayedCards(fourHPlay);
             const playedCardIds = fourHPlay.cards.map(card => card.id); gameState.players[playerIndex].hand = playerHand.filter(card => !playedCardIds.includes(card.id));
             gameState.isGameStarted = true; console.log(">>> Game started after 4H play.");
             logPlay(playerIndex, fourHPlay); renderPlayArea(gameState.lastPlayedHand); renderHands(gameState.players);
             if (gameState.players[playerIndex].hand.length === 0) { declareWinner(playerIndex); return; }
             if (fourHPlay.rankValue === ACE_VALUE) { console.log(`>>> Processing Ace play round win`); logEvent(`Aces played by ${playerName} - Round Over!`, "round-end"); logDetailedTurn('round_end', { reason: 'ace', winner: playerIndex }); updateStatus(`${playerName} played Aces...`); setTimeout(() => { startNextRound(playerIndex); }, ROUND_END_DELAY); return; }
             updateStatus(`${playerName} played. Advancing turn...`); advanceTurn(); return;
         } else {
             console.error(`AI (${playerName}) has 4♥ but couldn't find/choose a valid play! Passing (Error).`);
             logDetailedTurn('pass', { reason: 'no_4h_play_chosen' }); if (!gameState.passedPlayers.includes(playerIndex)) gameState.passedPlayers.push(playerIndex);
             logEvent(`${playerName} passed (Error).`, 'pass'); renderHands(gameState.players); updateStatus(`${playerName} passed (Error). Advancing turn...`); advanceTurn(); return;
         }
    }

    const validPlays = findValidPlays(playerHand, gameState.lastPlayedHand);
    let { chosenPlay, playStyle } = chooseBestPlay(validPlays, playerIndex);
    let executePass = !chosenPlay; let passReason = executePass ? playStyle : 'no_pass';

    if (chosenPlay && !executePass && shouldAIPassStrategically(chosenPlay, gameState, playerIndex, playStyle)) {
         const canPass = !(!gameState.lastPlayedHand || gameState.lastPlayedHand.playerIndex === playerIndex);
         if (canPass) { console.log(`AI (${playerName}) decided to pass strategically.`); chosenPlay = null; executePass = true; passReason = 'strategic'; }
         else { console.log(`AI (${playerName}) wanted to pass strategically, but cannot.`); executePass = false; }
    }
     if (chosenPlay && !executePass) {
         const isWinningPlay = playerHand.length === chosenPlay.quantity;
         if (isWinningPlay) {
             const isInvalidWinningPlay = chosenPlay.cards.some(card => card.value === ACE_VALUE || card.isWild);
             if (isInvalidWinningPlay) { console.log(`AI (${playerName}) chose invalid winning hand [${chosenPlay.cards.map(c=>c.display).join(', ')}]. Forcing pass.`); chosenPlay = null; executePass = true; passReason = 'invalid_win_forced_pass'; }
         }
     }

    if (chosenPlay && !executePass) {
        console.log(`AI (${playerName}) executing play:`, chosenPlay.cards.map(c=>c.display)); sortHand(chosenPlay.cards);
        logDetailedTurn('play', { cards: chosenPlay.cards.map(c => c.display).join(';'), rank: chosenPlay.rankValue, qty: chosenPlay.quantity, wilds: chosenPlay.usesWilds, style: playStyle });
        gameState.lastPlayedHand = { ...chosenPlay, playerIndex: playerIndex }; trackPlayedCards(chosenPlay);
        const playedCardIds = chosenPlay.cards.map(card => card.id); gameState.players[playerIndex].hand = playerHand.filter(card => !playedCardIds.includes(card.id));
        logPlay(playerIndex, chosenPlay); renderPlayArea(gameState.lastPlayedHand); renderHands(gameState.players);

        if (gameState.players[playerIndex].hand.length === 0) { declareWinner(playerIndex); return; }
        if (chosenPlay.rankValue === ACE_VALUE) { console.log(`>>> Processing Ace play round win for AI (${playerIndex}).`); logEvent(`Aces played by ${playerName} - Round Over!`, "round-end"); logDetailedTurn('round_end', { reason: 'ace', winner: playerIndex }); updateStatus(`${playerName} played Aces...`); setTimeout(() => { startNextRound(playerIndex); }, ROUND_END_DELAY); return; }
        advanceTurn();
    } else { // Execute Pass
        console.log(`AI (${playerName}) passing. Reason: ${passReason}.`); logDetailedTurn('pass', { reason: passReason });
        if (!gameState.passedPlayers.includes(playerIndex)) { gameState.passedPlayers.push(playerIndex); console.log(`AI ${playerName} added to passed list. Passed players: [${gameState.passedPlayers.join(', ')}]`); logEvent(`${playerName} passed.`, 'pass'); }
        renderHands(gameState.players); updateStatus(`${playerName} passed. Advancing turn...`);
        if (checkRoundOver()) {
            const roundWinnerIndex = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1;
            if (roundWinnerIndex !== -1) { const winnerName = gameState.players[roundWinnerIndex].name; console.log(`>>> AI Pass: Round over! Winner: Player ${roundWinnerIndex}.`); logEvent(`${winnerName} wins the round (opponents passed).`, 'round-end'); logDetailedTurn('round_end', { reason: 'pass', winner: roundWinnerIndex }); updateStatus(`Round over! ${winnerName} wins...`); setTimeout(() => { startNextRound(roundWinnerIndex); }, STANDARD_ROUND_END_DELAY); }
            else { console.error("Round over after AI pass, but couldn't determine winner!"); advanceTurn(); }
        } else { advanceTurn(); }
    }
}

// --- Round and Turn Management ---
function checkRoundOver() { const activePlayers = gameState.players.length; const neededToPass = activePlayers - 1; const result = gameState.passedPlayers.length >= neededToPass; console.log(`--- checkRoundOver: Passed players: [${gameState.passedPlayers.join(', ')}] (${gameState.passedPlayers.length}). Needed: ${neededToPass}. Result: ${result} ---`); return result; }
function startNextRound(winnerIndex) { console.log(`>>> startNextRound called for winner: Player ${winnerIndex} <<<`); if (gameState.isGameOver) return; const winnerName = gameState.players[winnerIndex].name; console.log(`Starting next round. Winner: ${winnerName}`); gameState.passedPlayers = []; console.log(">>> startNextRound: Passed players reset."); gameState.lastPlayedHand = null; renderPlayArea(null); const logArea = document.getElementById('play-log'); if (logArea) logArea.innerHTML = ''; else console.error("Play log area not found for clearing."); gameState.currentPlayerIndex = winnerIndex; renderHands(gameState.players); updateStatus(`Round won by ${winnerName}. Starting next round. It's ${winnerName}'s turn.`); if (winnerIndex > 0) { console.log(`Scheduling AI turn for ${winnerName} (starting new round) in ${ROUND_END_DELAY}ms`); setTimeout(() => { if(gameState.currentPlayerIndex === winnerIndex && !gameState.isGameOver) { console.log(`--- Timeout executing for startNextRound winner ${winnerName} ---`); handleAITurn(winnerIndex); } else { console.log(`--- Timeout skipped for startNextRound winner ${winnerName} (state changed) ---`); } }, ROUND_END_DELAY); } }
function advanceTurn() { console.log(`--- advanceTurn called. Current player: ${gameState.currentPlayerIndex} ---`); if (gameState.isGameOver) { console.log("advanceTurn: Game is over, returning."); return; } gameState.turnCount++; let nextPlayerIndex = gameState.currentPlayerIndex; let loopGuard = 0; const initialIndex = gameState.currentPlayerIndex; do { nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length; loopGuard++; console.log(`advanceTurn loop: Checking index ${nextPlayerIndex}. Passed: ${gameState.passedPlayers.includes(nextPlayerIndex)}. Guard: ${loopGuard}`); if (loopGuard > gameState.players.length * 2) { console.error("Infinite loop detected in advanceTurn! Breaking."); updateStatus("Error: Turn advancement loop detected."); return; } if (nextPlayerIndex === initialIndex && loopGuard > gameState.players.length) { console.error("advanceTurn looped back to start without finding next player. Round should be over?"); if(checkRoundOver()){ const rWI = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1; if(rWI !== -1) { console.log(`Round over detected in advanceTurn loop. Starting next round for winner ${rWI}`); startNextRound(rWI); } else { console.error("Round over state detected in advanceTurn loop, but no winner found."); updateStatus("Error: Could not determine round winner."); } } else { console.error("advanceTurn loop detected, but checkRoundOver is false?"); updateStatus("Error: Turn advancement failed."); } return; } } while (gameState.passedPlayers.includes(nextPlayerIndex)); console.log(`advanceTurn: Next player determined: ${nextPlayerIndex}`); gameState.currentPlayerIndex = nextPlayerIndex; const nextPlayer = gameState.players[gameState.currentPlayerIndex]; updateStatus(`It's ${nextPlayer.name}'s turn.`); renderHands(gameState.players); if (gameState.currentPlayerIndex > 0) { console.log(`Scheduling AI turn for ${nextPlayer.name} in ${AI_TURN_DELAY}ms`); setTimeout(() => { if(gameState.currentPlayerIndex === nextPlayer.id - 1 && !gameState.isGameOver) { console.log(`--- Timeout executing for AI ${nextPlayer.name} ---`); handleAITurn(gameState.currentPlayerIndex); } else { console.log(`--- Timeout skipped for AI ${nextPlayer.name} (state changed: Current: ${gameState.currentPlayerIndex}, Expected: ${nextPlayer.id - 1}, GameOver: ${gameState.isGameOver}) ---`); } }, AI_TURN_DELAY); } else { console.log("It's the Human player's turn."); } }

// --- Game Initialization ---
function initializeGame(showGamePage = true) {
    console.log("Initializing Swedish Kings...");
    updateStatus("Setting up game...");
    gameCounter++;
    currentGameDetailedLog = [];
    logDetailedTurn('game_start');

    // Assign random names to computer players
    let availableNames = [...COMPUTER_NAMES]; // Create a copy to modify
    // Player 1 (Computer 1) - Index 1
    let nameIndex1 = Math.floor(Math.random() * availableNames.length);
    gameState.players[1].name = availableNames[nameIndex1];
    availableNames.splice(nameIndex1, 1); // Remove chosen name
    // Player 2 (Computer 2) - Index 2
    let nameIndex2 = Math.floor(Math.random() * availableNames.length);
    gameState.players[2].name = availableNames[nameIndex2];
    console.log(`Assigned names: P1=${gameState.players[1].name}, P2=${gameState.players[2].name}`);


    gameState.deck = createDeck(); shuffleDeck(gameState.deck);
    // Reset hands (names are already set)
    gameState.players.forEach(p => { p.hand = []; });
    selectedCards = []; gameState.lastPlayedHand = null; gameState.passedPlayers = [];
    gameState.isGameOver = false; gameState.winner = null; gameState.isGameStarted = false;
    gameState.turnCount = 0; gameState.playedCards = {};
    dealCards(gameState.deck, gameState.players); console.log("Cards dealt.");

    // Ensure winner and passed classes are removed from all player areas on new game
    PLAYER_AREA_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
             el.classList.remove('player-wins');
             el.classList.remove('player-passed');
        }
    });

    let sPF = false;
    for (let i = 0; i < gameState.players.length; i++) { if (gameState.players[i].hand.some(c => c.rank === '4' && c.suit === 'hearts')) { gameState.currentPlayerIndex = i; sPF = true; break; } }
    if (!sPF) { console.error("CRITICAL ERROR: 4 of Hearts not found! Defaulting to Player 0."); gameState.currentPlayerIndex = 0; }

    renderHands(gameState.players); // Render hands AFTER names are assigned
    renderPlayArea(null);
    const logArea = document.getElementById('play-log'); if (logArea) logArea.innerHTML = '';
    const pB = document.getElementById('play-button'); const passB = document.getElementById('pass-button');
    if (pB) pB.disabled = false; if (passB) passB.disabled = false;
    const sN = gameState.players[gameState.currentPlayerIndex].name; // Get potentially randomized name
    updateStatus(`Game started. ${sN}'s turn. Must play 4♥.`);
    console.log(`Game ready. Starting player index: ${gameState.currentPlayerIndex} (${sN})`);
    if (showGamePage) { showPage('game-page'); }
    if (gameState.currentPlayerIndex > 0) {
        console.log(`Scheduling initial AI turn for ${sN} in ${AI_TURN_DELAY}ms`);
        setTimeout(() => {
             // Check using the index, as name might change if init is called again quickly? Unlikely but safer.
            if(gameState.currentPlayerIndex > 0 && gameState.currentPlayerIndex === (gameState.players[gameState.currentPlayerIndex].id - 1) && !gameState.isGameOver) {
                handleAITurn(gameState.currentPlayerIndex);
            } else {
                console.log(`Initial AI turn for P${gameState.currentPlayerIndex+1} skipped as state changed.`);
            }
         }, AI_TURN_DELAY);
    }
}

// --- Data Export Logic ---
function formatAllLogsForSheet(logData) { if (!logData || logData.length === 0) return "No game logs recorded yet. Play some games first!"; const headers = [ "GameID", "Turn", "PlayerIndex", "PlayerName", "Action", "CardsPlayed", "Rank", "Quantity", "UsedWilds", "AIPlayStyle", "HandSizeBefore", "PassedListBefore", "LastPlayRank", "LastPlayQty", "Reason", "Winner" ]; const rows = logData.map(entry => { const details = entry.details || {}; const cardsStr = details.cards ? `"${details.cards.replace(/"/g, '""')}"` : ''; return [ entry.gameId, entry.turn, entry.playerIndex, `"${entry.playerName.replace(/"/g, '""')}"`, entry.action, cardsStr, details.rank ?? '', details.qty ?? '', details.wilds ?? '', details.style ?? '', entry.handSizeBefore, `"${entry.passedPlayersBefore?.join(';') ?? ''}"`, entry.lastPlayRank ?? '', entry.lastPlayQty ?? '', details.reason ?? '', details.winner ?? '' ].join(','); }); return `${headers.join(',')}\n${rows.join('\n')}`; }
function handleExportLogs() { const resultsTextArea = document.getElementById('exported-logs-textarea'); const exportButton = document.getElementById('export-logs-button'); if (!resultsTextArea || !exportButton) { console.error("Export control elements not found."); return; } exportButton.disabled = true; resultsTextArea.value = "Generating CSV data..."; setTimeout(() => { const csvData = formatAllLogsForSheet(allGamesDetailedLog); resultsTextArea.value = csvData; exportButton.disabled = false; console.log("Log export complete. Data displayed."); }, 50); }

// --- Global Event Listeners ---
document.addEventListener('DOMContentLoaded', () => { initializeGame(false); showPage('rules-page'); const newGameButton = document.getElementById('new-game-button'); if (newGameButton) { newGameButton.addEventListener('click', () => initializeGame(true)); } else { console.error("New Game button not found"); } const playButton = document.getElementById('play-button'); const passButton = document.getElementById('pass-button'); if (playButton) { playButton.addEventListener('click', handlePlayAction); } else { console.error("Play button not found"); } if (passButton) { passButton.addEventListener('click', handlePassAction); } else { console.error("Pass button not found"); } const exportButton = document.getElementById('export-logs-button'); if (exportButton) { exportButton.addEventListener('click', handleExportLogs); } else { console.error("Export button not found"); } const startGameButton = document.getElementById('start-game-button'); if (startGameButton) { startGameButton.addEventListener('click', () => showPage('game-page')); } else { console.error("Start Game button not found"); } const showRulesButton = document.getElementById('show-rules-button'); if (showRulesButton) { showRulesButton.addEventListener('click', () => showPage('rules-page')); } else { console.error("Show Rules button not found"); } });