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
const JACK_VALUE = 11;
// const TEN_VALUE = 10; // Replaced by dynamicRule4RankThreshold usage
const ROYAL_VALUE_THRESHOLD = 11;
const WILD_PENALTY = 5;
const STARTING_ROUND_LOW_WILD_PENALTY = 20;
const AI_TURN_DELAY = 1000;
const AI_REASONING_DELAY = 300;
const ROUND_END_DELAY = AI_TURN_DELAY * 2;
const STANDARD_ROUND_END_DELAY = AI_TURN_DELAY * 1.5;
const FALLING_BEHIND_DIFF_P4 = 5;
const LEAVE_ONE_CARD_PENALTY = 50;
const AVG_SCORE_CATCHUP_THRESHOLD = 0.9;
const ENDGAME_THRESHOLD = 6;
const ENDGAME_SINGLE_THRESHOLD = 2;
const ENDGAME_UNNECESSARY_WILD_PENALTY = 15;
const PLAYER_AREA_IDS = ['human-player', 'computer-1', 'computer-2'];
const MIN_CARDS_FOR_WILD_PASS_RULE = 12;

// --- Dynamic Game Variables ---
let dynamicP2Threshold;
let dynamicWildcardPassThreshold;
let dynamicRule4RankThreshold;

// --- Computer Player Names ---
const COMPUTER_NAMES = [ /* ... Names ... */
    "John", "William", "James", "George", "Charles", "Robert", "Joseph", "Frank", "Edward", "Thomas",
    "Henry", "Walter", "Harry", "Willie", "Arthur", "Albert", "Clarence", "Fred", "Harold", "Paul",
    "Raymond", "Richard", "Roy", "Joe", "Louis", "Carl", "Ralph", "Earl", "Jack", "Ernest",
    "David", "Samuel", "Howard", "Charlie", "Francis", "Herbert", "Lawrence", "Theodore", "Alfred", "Andrew",
    "Elmer", "Sam", "Eugene", "Leo", "Michael", "Lee", "Herman", "Anthony", "Daniel", "Leonard",
    "Mary", "Helen", "Margaret", "Anna", "Ruth", "Elizabeth", "Dorothy", "Marie", "Florence", "Mildred",
    "Alice", "Ethel", "Lillian", "Gladys", "Edna", "Frances", "Rose", "Annie", "Grace", "Bertha",
    "Emma", "Bessie", "Clara", "Hazel", "Irene", "Gertrude", "Louise", "Catherine", "Martha", "Mabel",
    "Pearl", "Edith", "Esther", "Minnie", "Myrtle", "Ida", "Josephine", "Evelyn", "Elsie", "Eva",
    "Thelma", "Ruby", "Agnes", "Sarah", "Viola", "Nellie", "Beatrice", "Julia", "Laura", "Lillie"
];

// --- Game State ---
let gameState = {
    deck: [],
    players: [
        { id: 1, name: "You", hand: [] },
        { id: 2, name: "Computer 1", hand: [], lastReasoning: "" },
        { id: 3, name: "Computer 2", hand: [], lastReasoning: "" }
    ],
    currentPlayerIndex: -1, lastPlayedHand: null, passedPlayers: [], isGameOver: false, winner: null, isGameStarted: false, turnCount: 0, playedCards: {} };
let selectedCards = [];

// --- Logging State ---
let gameCounter = 0;
let allGamesDetailedLog = [];
let currentGameDetailedLog = [];

// --- Core Functions ---
function createCard(suit, rank) { const isWild = WILD_RANKS.includes(rank); let dR = rank; let dS = suit ? SUIT_SYMBOLS[suit] : ''; let id = rank === "Joker" ? `Joker-${Math.random().toString(36).substr(2, 5)}` : `${rank}-${suit}`; if (rank === "Joker") { dR = "Joker"; dS = ""; } return { id: id, suit: suit, rank: rank, value: RANK_VALUES[rank], isWild: isWild, display: `${dR}${dS}` }; }
function createDeck() { const d = []; for (const s of SUITS) { for (let i = 4; i <= 14; i++) { let r; if (i <= 10) r = String(i); else if (i === 11) r = "J"; else if (i === 12) r = "Q"; else if (i === 13) r = "K"; else if (i === 14) r = "A"; d.push(createCard(s, r)); } d.push(createCard(s, "2")); d.push(createCard(s, "3")); } d.push(createCard(null, "Joker")); d.push(createCard(null, "Joker")); return d; }
function shuffleDeck(deck) { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; } }
function dealCards(deck, players) { let pI = 0; while (deck.length > 0) { const c = deck.pop(); if (c && players[pI]) players[pI].hand.push(c); pI = (pI + 1) % players.length; } players.forEach(p => sortHand(p.hand)); }
function sortHand(hand) { if (!hand) return; hand.sort((a, b) => { const vA = a.value || 0; const vB = b.value || 0; if (vA !== vB) return vA - vB; const sO = { hearts: 1, diamonds: 2, clubs: 3, spades: 4, null: 5 }; return (sO[a.suit] || sO.null) - (sO[b.suit] || sO.null); }); }

// --- AI Score Calculation ---
function calculateHandRank(hand) { if (!hand || hand.length === 0) return 0; let score = 0; const rankCounts = {}; const basePoints = { A: 10, K: 8, Q: 6, J: 4, '10': 3, '9': 2, '8': 1 }; const wildPoints = { Joker: 5, '2': 4, '3': 4 }; for (const card of hand) { if (card.isWild) { score += wildPoints[card.rank] || 0; } else { score += basePoints[card.rank] || 0; rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1; } } for (const rank in rankCounts) { const count = rankCounts[rank]; const rankValue = RANK_VALUES[rank]; if (count >= 2) { score += (10 + Math.ceil(rankValue / 2)); } if (count >= 3) { score += (15 + rankValue); } if (count >= 4) { score += (15 + Math.ceil(rankValue * 1.5)); } } return score; }
function calculateAvgScore(hand) { if (!hand || hand.length === 0) return 0; const totalScore = calculateHandRank(hand); return totalScore / hand.length; }

// --- Helper: Get Rank Name ---
function getRankName(rankValue) { switch (rankValue) { case 4: return "FOUR"; case 5: return "FIVE"; case 6: return "SIX"; case 7: return "SEVEN"; case 8: return "EIGHT"; case 9: return "NINE"; case 10: return "TEN"; case 11: return "JACK"; case 12: return "QUEEN"; case 13: return "KING"; case 14: return "ACE"; default: return "UNKNOWN"; } }

// --- Helper: Generate AI Reasoning Text ---
function generateReasoningText(playStyle, chosenPlay = null, opponentHandSize = null) {
    let reason = "Thinking...";
    if (playStyle.startsWith('pass_')) { /* ... Pass reasons ... */ const reasonCode = playStyle.substring(5); switch (reasonCode) { case 'no_valid': reason = "Passed: No valid plays were available."; break; case 'confident': reason = "Passed: Had a valid play, but chose to pass while feeling confident."; break; case 'conservative': reason = "Passed: Had a valid play, but chose to pass to be more conservative."; break; case 'falling_behind': reason = "Passed: Could not find a suitable play to catch up."; break; case 'stop_opponent': reason = "Passed: Could not find a play to stop opponent."; break; case 'no_4h_play_chosen': reason = "Passed: Error - Had 4♥ but couldn't select a valid play."; break; case 'invalid_win_forced_pass': reason = "Passed: Intended winning play was invalid (contained Ace/Wild)."; break; case 'internal_error': reason = "Passed: Internal error occurred during decision making."; break; case 'strategic_high_wild_usage': reason = `Passed: Strategic Rule 5 - Play considered used too high % of available wildcards.`; break; default: reason = "Passed: No suitable play found based on current strategy."; } }
    else if (chosenPlay) { /* ... Play reasons ... */ const rankName = getRankName(chosenPlay.rankValue); const plural = chosenPlay.quantity > 1 ? 'S' : ''; const playDesc = `${chosenPlay.quantity}x ${rankName}${plural}`; const wildInfo = chosenPlay.usesWilds ? " (using wildcards)" : ""; switch (playStyle) { case 'winning': reason = `Played ${playDesc}${wildInfo} to win the game!`; break; case 'penultimate': reason = `Played ${playDesc}${wildInfo} to set up a potential win next turn.`; break; case 'penultimate_lower_rank': reason = `Played lower rank ${playDesc}${wildInfo} to set up a potential win next turn.`; break; case 'stop_opponent': reason = `Played ${playDesc}${wildInfo} aggressively as an opponent has <= ${dynamicP2Threshold} cards.`; break; case 'falling_behind_with_wilds': case 'falling_behind_no_wilds': reason = `Played ${playDesc}${wildInfo} trying to reduce hand size (currently falling behind).`; break; case 'confident_with_wilds': case 'confident_no_wilds': reason = `Played ${playDesc}${wildInfo} confidently while ahead or level.`; break; case 'conservative_with_wilds': case 'conservative_no_wilds': reason = `Played ${playDesc}${wildInfo} cautiously, trying to save stronger cards.`; break; case 'conservative_rank_plus_3': reason = `Played ${playDesc}${wildInfo} as a safe, non-royal, non-wild +3 rank play.`; break; case 'confident_ace_start_swap_no_wild': case 'conservative_ace_start_swap_no_wild': reason = `Played ${playDesc}${wildInfo} instead of lowest single to avoid using it when starting with an Ace.`; break; case 'start_4h': reason = `Played ${playDesc}${wildInfo} to start the game (must include 4♥).`; break;
            // --- Strategic Override Reasons ---
            case 'strategic_override_low_no_wild': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 4: Prefer/Override with low non-wild below ${dynamicRule4RankThreshold}).`; break;
            case 'strategic_override_ace': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 1: Override pass with single Ace).`; break;
            case 'strategic_override_low_wild': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 2: Override pass with low non-wild + wild).`; break;
            case 'strategic_override_second_low': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 3: Play second lowest single instead of lowest).`; break;
            // --- NEW Rule 6 Reasons ---
            case 'strategic_override_lowest_nw': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 6: Play lowest non-wild instead of pass).`; break;
            case 'strategic_override_below_jack_nw': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 6: Play non-wild below Jack instead of pass).`; break;
            default: reason = `Played ${playDesc}${wildInfo}. Strategy: ${playStyle}.`;
         }
     }
    return reason;
}


// --- Rendering Functions ---
function renderCard(card) { /* ... */ const cE = document.createElement('div'); cE.classList.add('card'); cE.dataset.cardId = card.id; cE.textContent = card.display; cE.style.color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black'; if (card.rank === 'Joker') cE.style.fontWeight = 'bold'; return cE; }
function renderHands(players) { /* ... */ const isGameOver = gameState.isGameOver; const passedPlayerIndices = gameState.passedPlayers; players.forEach((player, index) => { const isHuman = index === 0; let handElement, countElementId, playerAreaElement, reasoningElement; playerAreaElement = document.getElementById(PLAYER_AREA_IDS[index]); let playerNameElement = playerAreaElement?.querySelector('h2'); if (playerNameElement && player.name) { playerNameElement.textContent = player.name; } if (isHuman) { const wildsContainer = document.getElementById('p1-hand-wilds'); const lowContainer = document.getElementById('p1-hand-low'); const royalsContainer = document.getElementById('p1-hand-royals'); const countElement = document.getElementById('p1-count'); if (!wildsContainer || !lowContainer || !royalsContainer || !countElement) { return; } wildsContainer.innerHTML = ''; lowContainer.innerHTML = ''; royalsContainer.innerHTML = ''; if (player.hand) sortHand(player.hand); player.hand.forEach(card => { const cardEl = renderCard(card); const isSelected = selectedCards.some(selectedCard => selectedCard.id === card.id); if (!isGameOver && !passedPlayerIndices.includes(index)) { cardEl.addEventListener('click', handleCardClick); if (isSelected) { cardEl.classList.add('selected'); } } else { cardEl.style.cursor = 'default'; if (isSelected) { cardEl.classList.add('selected'); } } if (card.isWild) { wildsContainer.appendChild(cardEl); } else if (card.value < ROYAL_VALUE_THRESHOLD) { lowContainer.appendChild(cardEl); } else { royalsContainer.appendChild(cardEl); } }); countElement.textContent = player.hand?.length ?? 0; } else { if (index === 1) { handElementId = 'c1-hand'; countElementId = 'c1-count'; reasoningElement = document.getElementById('c1-reasoning'); } else { handElementId = 'c2-hand'; countElementId = 'c2-count'; reasoningElement = document.getElementById('c2-reasoning'); } handElement = document.getElementById(handElementId); const countElement = document.getElementById(countElementId); if (!handElement || !countElement || !reasoningElement) { return; } handElement.innerHTML = ''; if (isGameOver && player.hand && player.hand.length > 0) { sortHand(player.hand); player.hand.forEach(card => { const cardEl = renderCard(card); cardEl.style.cursor = 'default'; handElement.appendChild(cardEl); }); } else if (!isGameOver && player.hand) { player.hand.forEach(_ => { const cardEl = document.createElement('div'); cardEl.classList.add('card', 'card-back'); handElement.appendChild(cardEl); }); } countElement.textContent = player.hand?.length ?? 0; const reasoningParagraph = reasoningElement.querySelector('p'); if (reasoningParagraph) { let reasonText = player.lastReasoning || "Waiting..."; if (gameState.currentPlayerIndex === index && !isGameOver && !passedPlayerIndices.includes(index) && !player.lastReasoning) { reasonText = "Thinking..."; } reasoningParagraph.textContent = reasonText; } } if (playerAreaElement) { if (isGameOver && gameState.winner === index) { playerAreaElement.classList.add('player-wins'); } else { playerAreaElement.classList.remove('player-wins'); } if (!isGameOver && passedPlayerIndices.includes(index)) { playerAreaElement.classList.add('player-passed'); } else { playerAreaElement.classList.remove('player-passed'); } } }); updatePlayerHighlight(gameState.currentPlayerIndex); }
function renderPlayArea(playedHand) { /* ... */ const playAreaElement = document.getElementById('last-played'); const descriptionElement = document.getElementById('last-played-description'); if (!playAreaElement || !descriptionElement) { return; } playAreaElement.innerHTML = ''; descriptionElement.textContent = ''; if (playedHand && playedHand.cards && playedHand.cards.length > 0) { sortHand(playedHand.cards); playedHand.cards.forEach(c => { const cardElement = renderCard(c); cardElement.style.cursor = 'default'; playAreaElement.appendChild(cardElement); }); const quantity = playedHand.quantity; const rankValue = playedHand.rankValue; const rankName = getRankName(rankValue); const plural = quantity > 1 ? 'S' : ''; descriptionElement.textContent = `${quantity}x ${rankName}${plural}`; } }
function updateStatus(message) { /* ... */ const sE = document.getElementById('status-message'); if (sE) sE.textContent = message; }
function logPlay(playerIndex, playedHand) { /* ... */ const logArea = document.getElementById('play-log'); if (!logArea) { return; } const playerName = gameState.players[playerIndex]?.name ?? `Player ${playerIndex + 1}`; sortHand(playedHand.cards); const cardDisplays = playedHand.cards.map(c => c.display).join(', '); const logEntry = document.createElement('div'); logEntry.classList.add('log-entry'); logEntry.textContent = `${playerName} played: ${cardDisplays}`; logArea.prepend(logEntry); }
function logEvent(message, type = 'info') { /* ... */ const logArea = document.getElementById('play-log'); if (!logArea) { return; } const logEntry = document.createElement('div'); logEntry.classList.add('log-entry', `log-event-${type}`); logEntry.textContent = `--- ${message} ---`; logArea.prepend(logEntry); }
function updatePlayerHighlight(currentPlayerIndex) { /* ... */ PLAYER_AREA_IDS.forEach((id, i) => { const el = document.getElementById(id); if (el) { if (i === currentPlayerIndex && !gameState.isGameOver && !gameState.passedPlayers.includes(i)) { el.classList.add('current-player'); } else { el.classList.remove('current-player'); } } }); }

// --- Page Navigation & Card Selection ---
function showPage(pageIdToShow) { /* ... */ const pageIds = ['rules-page', 'game-page']; pageIds.forEach(id => { const element = document.getElementById(id); if (element) { element.style.display = (id === pageIdToShow) ? 'block' : 'none'; } }); window.scrollTo(0, 0); }
function handleCardClick(event) { /* ... */ if (gameState.isGameOver || gameState.passedPlayers.includes(0)) return; const clickedCardElement = event.target.closest('.card'); if (!clickedCardElement) return; const clickedCardId = clickedCardElement.dataset.cardId; if (!clickedCardId) return; const clickedCardObject = gameState.players[0]?.hand?.find(c => c.id === clickedCardId); if (!clickedCardObject) return; const rankToMatch = clickedCardObject.rank; const isClickedCardWild = clickedCardObject.isWild; const isClickedCardSelected = selectedCards.some(c => c.id === clickedCardId); if (isClickedCardWild) { if (isClickedCardSelected) { selectedCards = selectedCards.filter(c => c.id !== clickedCardId); } else { selectedCards.push(clickedCardObject); } } else { if (isClickedCardSelected) { selectedCards = selectedCards.filter(c => c.id !== clickedCardId); } else { const cardsOfSameRank = gameState.players[0].hand.filter( card => !card.isWild && card.rank === rankToMatch ); const currentSelectedIds = new Set(selectedCards.map(c => c.id)); cardsOfSameRank.forEach(card => { if (!currentSelectedIds.has(card.id)) { selectedCards.push(card); } }); } } renderHands(gameState.players); console.log("Selected cards:", selectedCards.map(c => c.display).join(', ')); }
function handleClearSelection() { /* ... */ if (gameState.isGameOver || gameState.currentPlayerIndex !== 0) return; if (selectedCards.length > 0) { console.log("Clear Selection button clicked."); selectedCards = []; renderHands(gameState.players); } }

// --- Logging & Game State ---
function logDetailedTurn(actionType, details = {}) { /* ... */ const entry={gameId:gameCounter,turn:gameState.turnCount,playerIndex:gameState.currentPlayerIndex,playerName:gameState.players[gameState.currentPlayerIndex]?.name||'N/A',action:actionType,handSizeBefore:gameState.players[gameState.currentPlayerIndex]?.hand?.length||0,passedPlayersBefore:[...gameState.passedPlayers],lastPlayRank:gameState.lastPlayedHand?.rankValue||null,lastPlayQty:gameState.lastPlayedHand?.quantity||null,details:details};currentGameDetailedLog.push(entry); }
function trackPlayedCards(playedHand) { /* ... */ if (!playedHand || !playedHand.cards) return; for (const card of playedHand.cards) { if (!card.isWild) { const rank = card.rank; gameState.playedCards[rank] = (gameState.playedCards[rank] || 0) + 1; } } }
function declareWinner(winnerIndex) { /* ... */ const winnerName = gameState.players[winnerIndex]?.name ?? `Player ${winnerIndex + 1}`; updateStatus(`${winnerName} won!`); gameState.isGameOver = true; gameState.winner = winnerIndex; logDetailedTurn('game_end', { winner: winnerIndex }); allGamesDetailedLog.push(...currentGameDetailedLog); const playButton = document.getElementById('play-button'); const passButton = document.getElementById('pass-button'); const clearButton = document.getElementById('clear-selection-button'); if (playButton) playButton.disabled = true; if (passButton) passButton.disabled = true; if (clearButton) clearButton.disabled = true; updatePlayerHighlight(-1); renderHands(gameState.players); }

// --- Action Handlers ---
function validateSelectedCardsCombo(cardsToCheck) { /* ... */ if (!cardsToCheck || cardsToCheck.length === 0) return { isValid: false, message: "No cards selected." }; const nWCs = cardsToCheck.filter(c => !c.isWild); if (nWCs.length === 0) return { isValid: false, message: "Cannot play only wild cards." }; const fRV = nWCs[0].value; const aSR = nWCs.every(c => c.value === fRV); if (!aSR) return { isValid: false, message: "Selected cards must be the same rank (or wildcards)." }; return { isValid: true, rankValue: fRV, quantity: cardsToCheck.length }; }
function handlePlayAction() { /* ... */ console.log("Play button clicked."); if (gameState.isGameOver) { updateStatus("Game is over."); return; } if (gameState.currentPlayerIndex !== 0) { updateStatus("It's not your turn."); return; } if (gameState.passedPlayers.includes(0)) { updateStatus("You have passed for this round."); return; } const cV = validateSelectedCardsCombo(selectedCards); if (!cV.isValid) { updateStatus(`Invalid play: ${cV.message}`); return; } const { rankValue: rV, quantity: q } = cV; sortHand(selectedCards); const cP = { cards: [...selectedCards], rankValue: rV, quantity: q, playerIndex: 0 }; const lP = gameState.lastPlayedHand; if (!gameState.isGameStarted) { if (!lP) { if (!selectedCards.some(c => c.rank === '4' && c.suit === 'hearts')) { updateStatus("Invalid play: First play must include the 4 of Hearts."); return; } gameState.isGameStarted = true; } else { console.error("Error: Game not started but lastPlayedHand exists."); return; } } else if (lP) { if (!(cP.rankValue > lP.rankValue && cP.quantity >= lP.quantity)) { updateStatus(`Invalid play: Must play higher rank (${cP.rankValue} vs ${lP.rankValue}) with at least same quantity (${cP.quantity} vs ${lP.quantity}).`); return; } } const playerHand = gameState.players[0]?.hand; if (!playerHand) return; const isWH = playerHand.length === selectedCards.length; if (isWH) { if (selectedCards.some(c => c.value === ACE_VALUE || c.isWild)) { updateStatus("Invalid play: Final hand cannot contain Aces or Wildcards."); return; } } logDetailedTurn('play', { cards: cP.cards.map(c => c.display).join(';'), rank: cP.rankValue, qty: cP.quantity, wilds: cP.cards.some(c => c.isWild), style: 'human' }); gameState.lastPlayedHand = cP; trackPlayedCards(cP); const playedCardIds = selectedCards.map(card => card.id); gameState.players[0].hand = playerHand.filter(card => !playedCardIds.includes(card.id)); selectedCards = []; logPlay(0, cP); renderPlayArea(gameState.lastPlayedHand); renderHands(gameState.players); if (gameState.players[0].hand.length === 0) { declareWinner(0); return; } if (cP.rankValue === ACE_VALUE) { logEvent("Aces played - Round Over!", "round-end"); logDetailedTurn('round_end', { reason: 'ace', winner: 0 }); updateStatus("Aces played! **You won the round!** Starting next..."); setTimeout(() => { startNextRound(0); }, ROUND_END_DELAY); return; } updateStatus("Play successful. Advancing turn..."); advanceTurn(); }
function handlePassAction() { /* ... */ console.log("Pass button clicked."); if (gameState.isGameOver) { updateStatus("Game is over."); return; } if (gameState.currentPlayerIndex !== 0) { updateStatus("It's not your turn."); return; } if (gameState.passedPlayers.includes(0)) { updateStatus("You have already passed for this round."); return; } if (!gameState.isGameStarted) { updateStatus("Cannot pass before the first card (4♥) is played."); return; } if (!gameState.lastPlayedHand || gameState.lastPlayedHand.playerIndex === 0) { updateStatus("Cannot pass when you start the round or just played."); return; } const playerIndex = gameState.currentPlayerIndex; const playerName = gameState.players[playerIndex].name; if (!gameState.passedPlayers.includes(playerIndex)) { logDetailedTurn('pass', { reason: 'manual' }); gameState.passedPlayers.push(playerIndex); logEvent(`${playerName} passed.`, 'pass'); } selectedCards = []; renderHands(gameState.players); if (checkRoundOver()) { const roundWinnerIndex = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1; if (roundWinnerIndex !== -1 && gameState.players[roundWinnerIndex]) { const winnerName = gameState.players[roundWinnerIndex].name; logEvent(`${winnerName} wins the round (opponents passed).`, 'round-end'); logDetailedTurn('round_end', { reason: 'pass', winner: roundWinnerIndex }); updateStatus(`Round over! ${winnerName} wins the round. Starting next...`); setTimeout(() => { startNextRound(roundWinnerIndex); }, STANDARD_ROUND_END_DELAY); } else { console.error("Round over, but couldn't determine winner!"); advanceTurn(); } } else { updateStatus("You passed. Advancing turn..."); advanceTurn(); } }

// --- AI Logic ---
function findValidPlays(hand, lastPlayedHand, isGameStartedSim = gameState.isGameStarted) { /* ... */ const validPlays = []; if (!hand || hand.length === 0) return validPlays; const availableWilds = hand.filter(c => c.isWild); const nonWildsGroupedByRank = hand.filter(c => !c.isWild).reduce((acc, c) => { if (!acc[c.rank]) acc[c.rank] = []; acc[c.rank].push(c); return acc; }, {}); const lastRankValue = lastPlayedHand?.rankValue ?? -1; const minQuantityNeeded = lastPlayedHand?.quantity ?? 1; for (const rank in nonWildsGroupedByRank) { const nonWildCardsOfRank = nonWildsGroupedByRank[rank]; const rankValue = nonWildCardsOfRank[0].value; if (lastPlayedHand && rankValue <= lastRankValue) continue; const numNonWilds = nonWildCardsOfRank.length; const maxPossibleQuantity = numNonWilds + availableWilds.length; for (let quantity = minQuantityNeeded; quantity <= maxPossibleQuantity; quantity++) { const numNonWildsToUse = Math.min(quantity, numNonWilds); const wildsNeeded = quantity - numNonWildsToUse; if (wildsNeeded >= 0 && wildsNeeded <= availableWilds.length) { const playCards = [ ...nonWildCardsOfRank.slice(0, numNonWildsToUse), ...availableWilds.slice(0, wildsNeeded) ]; if (playCards.length !== quantity) { continue; } const potentialPlay = { cards: playCards, rankValue: rankValue, quantity: quantity, usesWilds: wildsNeeded > 0, id: playCards.map(c=>c.id).sort().join('-') }; if (isPlayValidVsLast(potentialPlay, lastPlayedHand)) { validPlays.push(potentialPlay); } } } } if (!isGameStartedSim && !lastPlayedHand) { return validPlays.filter(p => p.cards.some(c => c.rank === '4' && c.suit === 'hearts')); } return validPlays; }
function isPlayValidVsLast(potentialPlay, lastPlayedHand) { /* ... */ if (!lastPlayedHand) return true; return potentialPlay.rankValue > lastPlayedHand.rankValue && potentialPlay.quantity >= lastPlayedHand.quantity; }
function getRemainingHand(currentHand, playToMake) { /* ... */ const playedCardIds = new Set(playToMake.cards.map(c => c.id)); return currentHand.filter(card => !playedCardIds.has(card.id)); }
function countDistinctNonWildRanks(hand) { /* ... */ const ranks = new Set(); hand.forEach(card => { if (!card.isWild) { ranks.add(card.rank); } }); return ranks.size; }
function getNonWildCardsByRank(hand) { /* ... */ return hand.filter(c => !c.isWild).reduce((acc, c) => { if (!acc[c.rank]) acc[c.rank] = []; acc[c.rank].push(c); return acc; }, {}); }
function findHighestNonWildCardId(hand) { /* ... */ let highestValue = -1; let highestId = null; hand.forEach(card => { if (!card.isWild && card.value > highestValue) { highestValue = card.value; highestId = card.id; } }); return highestId; }
function findLowestNonWildCardId(hand) { /* ... */ let lowestValue = Infinity; let lowestId = null; hand.forEach(card => { if (!card.isWild && card.value < lowestValue) { lowestValue = card.value; lowestId = card.id; } }); return lowestId; }
function findSecondLowestNonWildSinglePlay(hand, lastPlayedHand) { /* ... */ const nonWilds = hand.filter(c => !c.isWild); if (nonWilds.length < 2) { return null; } nonWilds.sort((a, b) => { const vA = a.value || 0; const vB = b.value || 0; if (vA !== vB) return vA - vB; const sO = { hearts: 1, diamonds: 2, clubs: 3, spades: 4, null: 5 }; return (sO[a.suit] || sO.null) - (sO[b.suit] || sO.null); }); const secondLowestCard = nonWilds[1]; const potentialPlay = { cards: [secondLowestCard], rankValue: secondLowestCard.value, quantity: 1, usesWilds: false }; if (isPlayValidVsLast(potentialPlay, lastPlayedHand)) { return potentialPlay; } else { if (!lastPlayedHand) return potentialPlay; return null; } }
function filterAndSortLowestP5P6(candidates, rankLimit, royalLimit, avoidHighestId, lowestCardIdInHand, lastRankValue) { /* ... */ if (!candidates || candidates.length === 0) return []; const lowestCardPlays = candidates.filter(play => lowestCardIdInHand !== null && play.cards.some(c => c.id === lowestCardIdInHand)); const lowestCardPlayIds = new Set(lowestCardPlays.map(p => p.cards.map(c => c.id).sort().join())); const filteredStandardPlays = candidates.filter(play => { const playId = play.cards.map(c => c.id).sort().join(); if (lowestCardPlayIds.has(playId)) { return false; } const rankCheck = lastRankValue === -1 || play.rankValue <= lastRankValue + rankLimit; const highestCheck = avoidHighestId === null || !play.cards.some(c => c.id === avoidHighestId); const royalCheck = !(lastRankValue >= QUEEN_VALUE && play.rankValue > lastRankValue + royalLimit); return rankCheck && highestCheck && royalCheck; }); const combinedCandidates = [...lowestCardPlays, ...filteredStandardPlays]; if (combinedCandidates.length > 0) { combinedCandidates.sort((a, b) => { if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; const wildsA = a.cards.filter(c => c.isWild).length; const wildsB = b.cards.filter(c => c.isWild).length; if (wildsA !== wildsB) return wildsA - wildsB; return b.quantity - a.quantity; }); return combinedCandidates; } return []; }

// --- chooseBestPlay Function ---
function chooseBestPlay(validPlays, playerIndex) { /* ... */ if (!validPlays || validPlays.length === 0) { return { chosenPlay: null, playStyle: 'pass_no_valid', passReasonDetails: { message: "No valid plays found." } }; } const aiPlayer = gameState.players[playerIndex]; if (!aiPlayer || !aiPlayer.hand) { return { chosenPlay: null, playStyle: 'pass_internal_error', passReasonDetails: { message: "Internal AI error." } }; } const aiHand = aiPlayer.hand; const lastPlayedHand = gameState.lastPlayedHand; const lastRankValue = lastPlayedHand?.rankValue ?? -1; const aiHandLength = aiHand.length; let playStyle = 'default'; let passReasonDetails = {}; const winningPlays = validPlays.filter(play => play.quantity === aiHandLength && !play.cards.some(c => c.value === ACE_VALUE || c.isWild)); if (winningPlays.length > 0) { playStyle = 'winning'; sortHand(winningPlays[0].cards); return { chosenPlay: winningPlays[0], playStyle: playStyle }; } let minOpponentHandSize = Infinity; let leadingPlayerHandSize = Infinity; let opponentCount = 0; let opponentAvgScores = []; gameState.players.forEach((player, index) => { if (index !== playerIndex && player) { opponentCount++; const oppHandLength = player.hand?.length ?? Infinity; minOpponentHandSize = Math.min(minOpponentHandSize, oppHandLength); leadingPlayerHandSize = Math.min(leadingPlayerHandSize, oppHandLength); opponentAvgScores.push(calculateAvgScore(player.hand)); } }); const myAvgScore = calculateAvgScore(aiHand); const tableAvgScore = opponentCount > 0 ? opponentAvgScores.reduce((a, b) => a + b, 0) / opponentCount : 0; const nonWildCardsByRank = getNonWildCardsByRank(aiHand); const distinctRankCount = Object.keys(nonWildCardsByRank).length; if (distinctRankCount === 2) { playStyle = 'penultimate'; const ranks = Object.keys(nonWildCardsByRank); const rankValue1 = RANK_VALUES[ranks[0]]; const rankValue2 = RANK_VALUES[ranks[1]]; const higherRank = rankValue1 > rankValue2 ? ranks[0] : ranks[1]; const lowerRank = rankValue1 < rankValue2 ? ranks[0] : ranks[1]; const higherRankCards = nonWildCardsByRank[higherRank]; const lowerRankCards = nonWildCardsByRank[lowerRank]; const wildCards = aiHand.filter(c => c.isWild); const playAttemptHigher = { cards: [...higherRankCards, ...wildCards], rankValue: RANK_VALUES[higherRank], quantity: higherRankCards.length + wildCards.length, usesWilds: wildCards.length > 0 }; if (isPlayValidVsLast(playAttemptHigher, lastPlayedHand)) { sortHand(playAttemptHigher.cards); return { chosenPlay: playAttemptHigher, playStyle: playStyle }; } const playAttemptLower = { cards: [...lowerRankCards, ...wildCards], rankValue: RANK_VALUES[lowerRank], quantity: lowerRankCards.length + wildCards.length, usesWilds: wildCards.length > 0 }; if (isPlayValidVsLast(playAttemptLower, lastPlayedHand)) { sortHand(playAttemptLower.cards); return { chosenPlay: playAttemptLower, playStyle: `${playStyle}_lower_rank` }; } } if (minOpponentHandSize <= dynamicP2Threshold) { playStyle = 'stop_opponent'; let P2Candidates = [...validPlays]; P2Candidates.sort((a, b) => { let scoreA = a.rankValue - (a.usesWilds ? WILD_PENALTY : 0); let scoreB = b.rankValue - (b.usesWilds ? WILD_PENALTY : 0); if (scoreA !== scoreB) return scoreB - scoreA; if (a.quantity !== b.quantity) return b.quantity - a.quantity; return b.rankValue - a.rankValue; }); if (P2Candidates.length > 0) { sortHand(P2Candidates[0].cards); return { chosenPlay: P2Candidates[0], playStyle: playStyle }; } passReasonDetails = { message: `Could not stop opponent (min hand ${minOpponentHandSize}).` }; return { chosenPlay: null, playStyle: `pass_${playStyle}`, passReasonDetails }; } if (aiHandLength >= leadingPlayerHandSize + FALLING_BEHIND_DIFF_P4) { playStyle = 'falling_behind'; let P4Candidates = [...validPlays]; P4Candidates.sort((a,b) => { if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; const wildsA = a.cards.filter(c => c.isWild).length; const wildsB = b.cards.filter(c => c.isWild).length; if (wildsA !== wildsB) return wildsA - wildsB; return b.quantity - a.quantity; }); if (P4Candidates.length > 0) { let chosenP4 = P4Candidates[0]; let p4Style = `${playStyle}${chosenP4.usesWilds ? '_with_wilds' : '_no_wilds'}`; sortHand(chosenP4.cards); return { chosenPlay: chosenP4, playStyle: p4Style }; } passReasonDetails = { message: `Falling behind (hand ${aiHandLength} vs leader ${leadingPlayerHandSize}).` }; return { chosenPlay: null, playStyle: `pass_${playStyle}`, passReasonDetails }; } const highestCardId = findHighestNonWildCardId(aiHand); const lowestCardId = findLowestNonWildCardId(aiHand); const lowestCardRank = lowestCardId ? RANK_VALUES[aiHand.find(c => c && c.id === lowestCardId)?.rank] : null; let potentialLowestPlay = null; let bestOverallValidPlay = null; if (validPlays.length > 0) { const sortedByRank = [...validPlays].sort((a, b) => a.rankValue - b.rankValue); potentialLowestPlay = { rankValue: sortedByRank[0].rankValue, quantity: sortedByRank[0].quantity, usesWilds: sortedByRank[0].usesWilds, cards: sortedByRank[0].cards, isLowestRank: sortedByRank[0].rankValue === lowestCardRank, id: sortedByRank[0].cards.map(c => c.id).sort().join('-') }; passReasonDetails.lowestPlayInfo = potentialLowestPlay; bestOverallValidPlay = [...validPlays].sort((a, b) => { if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; const wildsA = a.cards.filter(c => c.isWild).length; const wildsB = b.cards.filter(c => c.isWild).length; if (wildsA !== wildsB) return wildsA - wildsB; return b.quantity - a.quantity; })[0]; } passReasonDetails.initialCandidate = bestOverallValidPlay; if (myAvgScore >= tableAvgScore) { playStyle = 'confident'; let P5Choice = null; let filteredList = filterAndSortLowestP5P6(validPlays, 4, 2, highestCardId, lowestCardId, lastRankValue); if (filteredList && filteredList.length > 0) { P5Choice = filteredList[0]; passReasonDetails.initialCandidate = P5Choice; playStyle = `${playStyle}${P5Choice.usesWilds ? '_with_wilds' : '_no_wilds'}`; const startingRound = !lastPlayedHand; const holdingAce = aiHand.some(c => c.rank === 'A'); const lowestIsSingle = P5Choice.rankValue === lowestCardRank && P5Choice.quantity === 1; if (startingRound && holdingAce && lowestIsSingle) { let foundAlternative = false; for (let i = 1; i < filteredList.length; i++) { if (!filteredList[i].usesWilds) { P5Choice = filteredList[i]; playStyle = 'confident_ace_start_swap_no_wild'; foundAlternative = true; break; } } } sortHand(P5Choice.cards); return { chosenPlay: P5Choice, playStyle: playStyle, passReasonDetails: passReasonDetails }; } else { passReasonDetails.message = `Confident state pass.`; return { chosenPlay: null, playStyle: `pass_${playStyle}`, passReasonDetails }; } } else { playStyle = 'conservative'; let P6Choice = null; let rankPlus3Play = null; if (lastRankValue !== -1) { const potentialRank = lastRankValue + 3; const rankPlus3Candidates = validPlays.filter(play => play.rankValue === potentialRank && !play.usesWilds && play.rankValue < ROYAL_VALUE_THRESHOLD); if (rankPlus3Candidates.length > 0) { rankPlus3Candidates.sort((a, b) => b.quantity - a.quantity); rankPlus3Play = rankPlus3Candidates[0]; } } let filteredList = filterAndSortLowestP5P6(validPlays, 2, 1, highestCardId, lowestCardId, lastRankValue); let combinedP6Candidates = []; if (filteredList && filteredList.length > 0) { combinedP6Candidates.push(...filteredList); } if (rankPlus3Play) { const rankPlus3PlayId = rankPlus3Play.cards.map(c => c.id).sort().join(); if (!combinedP6Candidates.some(p => p.cards.map(c => c.id).sort().join() === rankPlus3PlayId)) { combinedP6Candidates.push(rankPlus3Play); } } if (combinedP6Candidates.length > 0) { combinedP6Candidates.sort((a, b) => { if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; const wildsA = a.cards.filter(c => c.isWild).length; const wildsB = b.cards.filter(c => c.isWild).length; if (wildsA !== wildsB) return wildsA - wildsB; return b.quantity - a.quantity; }); P6Choice = combinedP6Candidates[0]; passReasonDetails.initialCandidate = P6Choice; playStyle = `${playStyle}${P6Choice.usesWilds ? '_with_wilds' : '_no_wilds'}`; if (P6Choice === rankPlus3Play) { playStyle = 'conservative_rank_plus_3'; } const startingRound = !lastPlayedHand; const holdingAce = aiHand.some(c => c.rank === 'A'); const isLowestRankPlay = P6Choice.rankValue === lowestCardRank; const isSinglePlay = P6Choice.quantity === 1; if (startingRound && holdingAce && isLowestRankPlay && isSinglePlay) { let foundAlternative = false; for (let i = 1; i < combinedP6Candidates.length; i++) { if (!combinedP6Candidates[i].usesWilds) { P6Choice = combinedP6Candidates[i]; playStyle = 'conservative_ace_start_swap_no_wild'; foundAlternative = true; break; } } } sortHand(P6Choice.cards); return { chosenPlay: P6Choice, playStyle: playStyle, passReasonDetails: passReasonDetails }; } else { passReasonDetails.message = `Conservative state pass.`; return { chosenPlay: null, playStyle: `pass_${playStyle}`, passReasonDetails }; } } }

// --- Updated handleAITurn ---
function handleAITurn(playerIndex) {
    const aiPlayer = gameState.players[playerIndex];
    if (!aiPlayer || !aiPlayer.hand) { console.error(`handleAITurn: Invalid playerIndex ${playerIndex} or missing hand.`); return; }

    const playerName = aiPlayer.name;
    const playerHand = aiPlayer.hand;
    console.log(`--- AI Turn Start: ${playerName} (Index: ${playerIndex}) ---`);
    console.log(`Current hand (${playerHand.length}): ${playerHand.map(c => c.display).join(', ')}`);
    console.log(`Current passedPlayers: [${gameState.passedPlayers.join(', ')}]`);

    aiPlayer.lastReasoning = "Thinking...";
    renderHands(gameState.players);

    setTimeout(() => {
        gameState.turnCount++;
        let actionReason = "";
        let chosenPlay = null; // Final decision play
        let playStyle = 'default'; // Final decision style
        let executePass = false; // Final decision pass flag

        const validPlays = findValidPlays(playerHand, gameState.lastPlayedHand);
        let minOpponentHandSizeForReasoning = Infinity;
        gameState.players.forEach((p, idx) => { if(idx !== playerIndex && p && p.hand) { minOpponentHandSizeForReasoning = Math.min(minOpponentHandSizeForReasoning, p.hand.length); } });
        const isStartingRound = !gameState.lastPlayedHand;

        // --- Initial Decision Making ---
        let initialDecision = {};
        if (!gameState.isGameStarted && playerHand.some(card => card.rank === '4' && card.suit === 'hearts')) {
            const fourHPlays = validPlays.filter(p => p.cards.some(c => c.rank === '4' && c.suit === 'hearts'));
            if (fourHPlays.length > 0) {
                initialDecision = chooseBestPlay(fourHPlays, playerIndex);
                chosenPlay = initialDecision.chosenPlay || fourHPlays[0];
                playStyle = 'start_4h'; gameState.isGameStarted = true; executePass = false;
            } else {
                executePass = true; playStyle = 'pass_no_4h_play_chosen';
            }
        } else {
            initialDecision = chooseBestPlay(validPlays, playerIndex);
            chosenPlay = initialDecision.chosenPlay;
            playStyle = initialDecision.playStyle;
            executePass = !chosenPlay; // Initial pass flag
            console.log(`AI (${playerName}) initial decision: Style=${playStyle}, Play=${chosenPlay ? chosenPlay.cards.map(c=>c.display).join(',') : 'None'}, ExecutePass=${executePass}`);
        }

        // --- Strategic Override Logic ---
        if (playStyle.startsWith('confident') || playStyle.startsWith('conservative')) {
            console.log(`AI (${playerName}) evaluating strategic rules for ${playStyle} mode.`);
            let strategicOverrideOccurred = false;
            let overrideChosen = false;
            const passDetails = initialDecision.passReasonDetails || {};
            const playToCheckForRule5 = chosenPlay || passDetails.initialCandidate;

            // --- Rule 5 Check ---
            if (playToCheckForRule5 && playToCheckForRule5.usesWilds && playerHand.length >= MIN_CARDS_FOR_WILD_PASS_RULE) {
                const totalWildsInHand = playerHand.filter(c => c.isWild).length;
                const wildsUsedInCheck = playToCheckForRule5.cards.filter(c => c.isWild).length;
                if (totalWildsInHand > 0) {
                    const wildcardUsageRatio = wildsUsedInCheck / totalWildsInHand;
                     if (wildcardUsageRatio > dynamicWildcardPassThreshold) {
                         console.log(`AI (${playerName}) Strategic Rule 5: Play uses too many wilds. Forcing PASS.`);
                         chosenPlay = null; executePass = true; playStyle = 'pass_strategic_high_wild_usage'; strategicOverrideOccurred = true;
                     }
                }
            }

            // --- Check Other Rules (Only if Rule 5 didn't force pass) ---
            if (!executePass) {
                // Find candidates first
                let potentialRule4Play = null;
                if (!isStartingRound) {
                    const lowNonWildPlays = validPlays.filter(play => !play.usesWilds && play.rankValue < dynamicRule4RankThreshold);
                    if (lowNonWildPlays.length > 0) { lowNonWildPlays.sort((a, b) => a.rankValue - b.rankValue || b.quantity - a.quantity); potentialRule4Play = lowNonWildPlays[0]; }
                }

                let potentialRule1Play = null;
                if (!isStartingRound) {
                    const aceCount = playerHand.filter(c => c.rank === 'A').length;
                    if (aceCount >= 2) { potentialRule1Play = validPlays.find(p => p.quantity === 1 && p.rankValue === ACE_VALUE); }
                }

                let potentialRule3Play = null;
                const hasAce = playerHand.some(c => c.rank === 'A');
                const lowestPlayInfo = passDetails.lowestPlayInfo;
                const initialChoice = chosenPlay || passDetails.initialCandidate;
                const initialChoiceWasLowestSingle = initialChoice && lowestPlayInfo && initialChoice.id === lowestPlayInfo.id && initialChoice.quantity === 1;
                if (isStartingRound && hasAce && initialChoiceWasLowestSingle) {
                    potentialRule3Play = findSecondLowestNonWildSinglePlay(playerHand, gameState.lastPlayedHand);
                }

                // --- Apply Rule 3 first if applicable ---
                if (potentialRule3Play) {
                     console.log(`AI (${playerName}) Strategic Rule 3: Applying Ace/Lowest Start rule. Playing 2nd lowest single.`);
                     chosenPlay = potentialRule3Play; playStyle = 'strategic_override_second_low'; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                }

                // --- Check Rules 6, 4, 1, 2 if Rule 3 didn't apply ---
                if (!overrideChosen) {
                    const initialDecisionWasPass = !initialDecision.chosenPlay;

                    if (initialDecisionWasPass) {
                        // --- Override PASS ---
                        console.log(`AI (${playerName}) Initial decision was PASS. Checking Rules 6, 4, 1, 2...`);

                        // *** NEW Rule 6 Check ***
                        let potentialRule6Play = null;
                        let rule6Style = '';
                        // Condition A: Can play lowest non-wild single?
                        const lowestCardNonWildId = findLowestNonWildCardId(playerHand);
                        let lowestSinglePlay = null;
                        if(lowestCardNonWildId) {
                            const lowestCard = playerHand.find(c => c.id === lowestCardNonWildId);
                             if (lowestCard) {
                                 const testPlay = { cards: [lowestCard], rankValue: lowestCard.value, quantity: 1, usesWilds: false, id: lowestCard.id };
                                 if (isPlayValidVsLast(testPlay, gameState.lastPlayedHand)) {
                                     lowestSinglePlay = testPlay;
                                 }
                             }
                        }
                        // Condition B: Can play any non-wild below Jack?
                        let belowJackPlays = null;
                        if (!lowestSinglePlay) { // Only check if condition A failed
                            belowJackPlays = validPlays.filter(play => !play.usesWilds && play.rankValue < JACK_VALUE);
                            if (belowJackPlays.length > 0) {
                                // Sort to find best (lowest rank, highest quantity)
                                belowJackPlays.sort((a, b) => a.rankValue - b.rankValue || b.quantity - a.quantity);
                            } else {
                                belowJackPlays = null; // Ensure it's null if empty
                            }
                        }
                        // Apply Rule 6 if either condition met
                        if (lowestSinglePlay) {
                            potentialRule6Play = lowestSinglePlay;
                            rule6Style = 'strategic_override_lowest_nw';
                        } else if (belowJackPlays) {
                            potentialRule6Play = belowJackPlays[0];
                            rule6Style = 'strategic_override_below_jack_nw';
                        }
                        // If Rule 6 found a play, override
                        if (potentialRule6Play) {
                             console.log(`AI (${playerName}) Strategic Rule 6: Overriding initial PASS with simple non-wild play.`);
                             chosenPlay = potentialRule6Play; playStyle = rule6Style; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                        }
                        // *** End Rule 6 Check ***


                        // Check Rule 4 Pass Override (Only if Rule 6 didn't apply)
                        if (!overrideChosen && potentialRule4Play) {
                            console.log(`AI (${playerName}) Strategic Rule 4: Overriding initial PASS with low non-wild.`);
                            chosenPlay = potentialRule4Play; playStyle = 'strategic_override_low_no_wild'; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                        }
                        // Check Rule 1 Pass Override (Only if Rules 6 & 4 didn't apply)
                        if (!overrideChosen && potentialRule1Play) { // Already includes !isStartingRound check
                             console.log(`AI (${playerName}) Strategic Rule 1: Overriding initial PASS with single Ace.`);
                             chosenPlay = potentialRule1Play; playStyle = 'strategic_override_ace'; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                        }
                        // Rule 2 Pass Override check (Only if 6, 4, 1 didn't apply)
                        const wildCount = playerHand.filter(c => c.isWild).length;
                        const initialPassWasOnDouble = passDetails.initialCandidate?.quantity === 2;
                        const lastRankValue = gameState.lastPlayedHand?.rankValue ?? -1;
                        if (!overrideChosen && wildCount >= 3 && lastRankValue < JACK_VALUE && initialPassWasOnDouble) {
                            const nonWildsSorted = playerHand.filter(c => !c.isWild).sort((a, b) => a.value - b.value);
                            const lowestNonWildCard = nonWildsSorted.length > 0 ? nonWildsSorted[0] : null;
                            const availableWild = playerHand.find(c => c.isWild);
                            if (lowestNonWildCard && availableWild) {
                                 const lowestPlusWildPlay = { cards: [lowestNonWildCard, availableWild], rankValue: lowestNonWildCard.value, quantity: 2, usesWilds: true, id: [lowestNonWildCard.id, availableWild.id].sort().join('-') };
                                 if (isPlayValidVsLast(lowestPlusWildPlay, gameState.lastPlayedHand)) {
                                    console.log(`AI (${playerName}) Strategic Rule 2: Overriding initial PASS with low non-wild + wild.`);
                                    chosenPlay = lowestPlusWildPlay; playStyle = 'strategic_override_low_wild'; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                                 }
                            }
                        }

                    } else {
                        // --- Potentially Refine PLAY (Only Rule 4 applicable here currently) ---
                        // Check Rule 4 Refinement (Now includes !isStartingRound check implicitly via potentialRule4Play)
                         if (potentialRule4Play && chosenPlay) {
                             if (chosenPlay.usesWilds || potentialRule4Play.rankValue < chosenPlay.rankValue) {
                                console.log(`AI (${playerName}) Strategic Rule 4: Refining play. Preferring low non-wild.`);
                                chosenPlay = potentialRule4Play; playStyle = 'strategic_override_low_no_wild'; strategicOverrideOccurred = true; overrideChosen = true;
                             }
                        }
                    }
                }
            } // End check for !executePass (Rule 5 didn't trigger)
        } // End check for Confident/Conservative style


        // --- Final Action Determination ---
        if (!executePass && chosenPlay && playerHand.length === chosenPlay.quantity) {
            if (chosenPlay.cards.some(card => card.value === ACE_VALUE || card.isWild)) {
                console.log(`AI (${playerName}) final play [${chosenPlay.cards.map(c=>c.display).join(', ')}] is invalid win. Forcing pass.`);
                chosenPlay = null; executePass = true; playStyle = 'pass_invalid_win_forced_pass';
            }
        }

        actionReason = generateReasoningText(playStyle, chosenPlay, minOpponentHandSizeForReasoning);
        aiPlayer.lastReasoning = actionReason;
        console.log(`AI (${playerName}) final action: ${executePass ? 'PASS' : 'PLAY ' + (chosenPlay ? chosenPlay.cards.map(c=>c.display).join(',') : 'ERROR')}. Reason: ${actionReason}`);

        // --- Execute Final Action ---
        if (!executePass && chosenPlay) {
            sortHand(chosenPlay.cards);
            logDetailedTurn('play', { cards: chosenPlay.cards.map(c => c.display).join(';'), rank: chosenPlay.rankValue, qty: chosenPlay.quantity, wilds: chosenPlay.usesWilds, style: playStyle });
            gameState.lastPlayedHand = { ...chosenPlay, playerIndex: playerIndex };
            trackPlayedCards(chosenPlay);
            const playedCardIds = new Set(chosenPlay.cards.map(card => card.id));
            gameState.players[playerIndex].hand = playerHand.filter(card => !playedCardIds.has(card.id));
            logPlay(playerIndex, chosenPlay); renderPlayArea(gameState.lastPlayedHand); renderHands(gameState.players);
            if (gameState.players[playerIndex]?.hand?.length === 0) { declareWinner(playerIndex); return; }
            if (chosenPlay.rankValue === ACE_VALUE) {
                logEvent(`Aces played by ${playerName} - Round Over!`, "round-end"); logDetailedTurn('round_end', { reason: 'ace', winner: playerIndex }); updateStatus(`${playerName} played Aces...`);
                setTimeout(() => { startNextRound(playerIndex); }, ROUND_END_DELAY); return;
            }
            advanceTurn();
        } else {
             logDetailedTurn('pass', { reason: playStyle.startsWith('pass_') ? playStyle.substring(5) : playStyle });
             if (!gameState.passedPlayers.includes(playerIndex)) { gameState.passedPlayers.push(playerIndex); logEvent(`${playerName} passed.`, 'pass'); }
             renderHands(gameState.players); updateStatus(`${playerName} passed. Advancing turn...`);
            if (checkRoundOver()) {
                const roundWinnerIndex = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1;
                if (roundWinnerIndex !== -1 && gameState.players[roundWinnerIndex]) {
                    const winnerName = gameState.players[roundWinnerIndex].name; logEvent(`${winnerName} wins the round (opponents passed).`, 'round-end'); logDetailedTurn('round_end', { reason: 'pass', winner: roundWinnerIndex }); updateStatus(`Round over! ${winnerName} wins...`);
                    setTimeout(() => { startNextRound(roundWinnerIndex); }, STANDARD_ROUND_END_DELAY);
                } else { console.error(`Round over after AI pass, but couldn't determine winner! Last play owner: ${roundWinnerIndex}`); advanceTurn(); }
            } else { advanceTurn(); }
        }

    }, AI_REASONING_DELAY);
}

// --- Round and Turn Management ---
function checkRoundOver() { /* ... */ if (!gameState || !gameState.players || gameState.players.length === 0) return false; const activePlayers = gameState.players.length; const neededToPass = activePlayers - 1; const result = gameState.passedPlayers.length >= neededToPass; return result; }
function startNextRound(winnerIndex) { /* ... */ console.log(`>>> startNextRound called for winner: Player ${winnerIndex} <<<`); if (gameState.isGameOver) return; if (winnerIndex < 0 || winnerIndex >= gameState.players.length || !gameState.players[winnerIndex]) { console.error(`startNextRound: Invalid winnerIndex ${winnerIndex}`); return; } const winnerName = gameState.players[winnerIndex].name; console.log(`Starting next round. Winner: ${winnerName}`); gameState.passedPlayers = []; gameState.players.forEach(p => { if(p && p.id !== 1) p.lastReasoning = ""; }); gameState.lastPlayedHand = null; renderPlayArea(null); const logArea = document.getElementById('play-log'); if (logArea) logArea.innerHTML = ''; gameState.currentPlayerIndex = winnerIndex; renderHands(gameState.players); updateStatus(`Round won by ${winnerName}. Starting next round. It's ${winnerName}'s turn.`); if (winnerIndex > 0) { if (gameState.players[winnerIndex]) { gameState.players[winnerIndex].lastReasoning = "Thinking..."; renderHands(gameState.players); } console.log(`Scheduling AI turn for ${winnerName} (starting new round) in ${ROUND_END_DELAY}ms`); setTimeout(() => { if (gameState.currentPlayerIndex === winnerIndex && !gameState.isGameOver) { handleAITurn(winnerIndex); } else { console.log(`Timeout skipped for startNextRound winner ${winnerName} (state changed)`); } }, ROUND_END_DELAY); } }
function advanceTurn() { /* ... */ if (gameState.isGameOver) { return; } let nextPlayerIndex = gameState.currentPlayerIndex; let loopGuard = 0; const initialIndex = gameState.currentPlayerIndex; do { nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length; loopGuard++; if (loopGuard > gameState.players.length * 2) { console.error("Infinite loop detected in advanceTurn! Breaking."); updateStatus("Error: Turn advancement loop detected."); return; } if (nextPlayerIndex === initialIndex && loopGuard > gameState.players.length) { if(checkRoundOver()){ const rWI = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1; if(rWI !== -1 && rWI < gameState.players.length && gameState.players[rWI]) { startNextRound(rWI); } else { console.error(`Round over state detected in advanceTurn loop, but winner index ${rWI} is invalid.`); updateStatus("Error: Could not determine round winner."); } } else { console.error("advanceTurn loop detected, but checkRoundOver is false?"); updateStatus("Error: Turn advancement failed."); } return; } } while (gameState.passedPlayers.includes(nextPlayerIndex)); gameState.currentPlayerIndex = nextPlayerIndex; if (nextPlayerIndex < 0 || nextPlayerIndex >= gameState.players.length || !gameState.players[nextPlayerIndex]) { console.error(`advanceTurn: Determined invalid nextPlayerIndex ${nextPlayerIndex}`); updateStatus("Error: Invalid next player."); return; } const nextPlayer = gameState.players[gameState.currentPlayerIndex]; updateStatus(`It's ${nextPlayer.name}'s turn.`); renderHands(gameState.players); if (gameState.currentPlayerIndex > 0) { setTimeout(() => { if (gameState.currentPlayerIndex === nextPlayer.id - 1 && !gameState.isGameOver && gameState.players[gameState.currentPlayerIndex]) { handleAITurn(gameState.currentPlayerIndex); } }, AI_TURN_DELAY); } }

// --- Updated Game Initialization ---
function initializeGame(showGamePage = true) {
    console.log("Initializing Swedish Kings...");
    updateStatus("Setting up game...");

    dynamicP2Threshold = Math.random() < 0.5 ? 3 : 4;
    dynamicWildcardPassThreshold = Math.random() < 0.5 ? 0.40 : 0.50;
    dynamicRule4RankThreshold = Math.floor(Math.random() * 5) + 6; // 6-10
    console.log(`Game Settings: P2 <= ${dynamicP2Threshold}, Wild Pass > ${dynamicWildcardPassThreshold * 100}%, Rule 4 Rank < ${dynamicRule4RankThreshold}`);

    gameCounter++;
    currentGameDetailedLog = [];
    logDetailedTurn('game_start', {
        p2Threshold: dynamicP2Threshold,
        wildPassThreshold: dynamicWildcardPassThreshold,
        rule4RankThreshold: dynamicRule4RankThreshold
    });

    let availableNames = [...COMPUTER_NAMES];
    let nameIndex1 = Math.floor(Math.random() * availableNames.length);
    gameState.players[1].name = availableNames[nameIndex1]; availableNames.splice(nameIndex1, 1);
    let nameIndex2 = Math.floor(Math.random() * availableNames.length);
    gameState.players[2].name = availableNames[nameIndex2];
    console.log(`Assigned names: P1=${gameState.players[1].name}, P2=${gameState.players[2].name}`);
    gameState.deck = createDeck(); shuffleDeck(gameState.deck);
    gameState.players.forEach(p => { if(p) { p.hand = []; if (p.id !== 1) p.lastReasoning = ""; }});
    selectedCards = []; gameState.lastPlayedHand = null; gameState.passedPlayers = [];
    gameState.isGameOver = false; gameState.winner = null; gameState.isGameStarted = false;
    gameState.turnCount = 0; gameState.playedCards = {};
    dealCards(gameState.deck, gameState.players); console.log("Cards dealt.");
    PLAYER_AREA_IDS.forEach(id => { const el = document.getElementById(id); if (el) { el.classList.remove('player-wins', 'player-passed'); } });
    let sPF = false; gameState.currentPlayerIndex = -1;
    for (let i = 0; i < gameState.players.length; i++) { if (gameState.players[i]?.hand?.some(c => c.rank === '4' && c.suit === 'hearts')) { gameState.currentPlayerIndex = i; sPF = true; break; } }
    if (!sPF || gameState.currentPlayerIndex === -1) { console.error("CRITICAL ERROR: 4 of Hearts not found! Defaulting to Player 0."); gameState.currentPlayerIndex = 0; if (!gameState.players[0]) { console.error("CRITICAL ERROR: Player 0 missing after default."); updateStatus("Error: Init failed."); return; } }
    renderHands(gameState.players); renderPlayArea(null);
    const logArea = document.getElementById('play-log'); if (logArea) logArea.innerHTML = '';
    const pB = document.getElementById('play-button'); const passB = document.getElementById('pass-button'); const clearB = document.getElementById('clear-selection-button');
    if (pB) pB.disabled = false; if (passB) passB.disabled = false; if (clearB) clearB.disabled = false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) { console.error(`CRITICAL ERROR: Start index ${gameState.currentPlayerIndex} invalid.`); updateStatus("Error: Failed player set."); return; }
    const sN = currentPlayer.name;
    updateStatus(`Game started. ${sN}'s turn. Must play 4♥.`);
    console.log(`Game ready. Starting player index: ${gameState.currentPlayerIndex} (${sN})`);
    if (showGamePage) { showPage('game-page'); }
    if (gameState.currentPlayerIndex > 0) {
        if (gameState.players[gameState.currentPlayerIndex]) { gameState.players[gameState.currentPlayerIndex].lastReasoning = "Thinking..."; renderHands(gameState.players); }
        console.log(`Scheduling initial AI turn for ${sN} in ${AI_TURN_DELAY}ms`);
        setTimeout(() => { const startingAIPlayer = gameState.players[gameState.currentPlayerIndex]; if (gameState.currentPlayerIndex > 0 && startingAIPlayer && gameState.currentPlayerIndex === (startingAIPlayer.id - 1) && !gameState.isGameOver) { handleAITurn(gameState.currentPlayerIndex); } else { console.log(`Initial AI turn for P${gameState.currentPlayerIndex+1} skipped (state changed).`); } }, AI_TURN_DELAY);
    }
}


// --- Updated Data Export Logic ---
function formatAllLogsForSheet(logData) { if (!logData || logData.length === 0) return "No game logs recorded yet. Play some games first!";
    const headers = [ "GameID", "Turn", "PlayerIndex", "PlayerName", "Action", "CardsPlayed", "Rank", "Quantity", "UsedWilds", "AIPlayStyle", "HandSizeBefore", "PassedListBefore", "LastPlayRank", "LastPlayQty", "Reason", "Winner", "P2Threshold", "WildPassThreshold", "Rule4RankThreshold" ]; // Added Rule4RankThreshold
    const rows = logData.map(entry => {
        const details = entry.details || {};
        const cardsStr = details.cards ? `"${details.cards.map(c=>c.display).join(';').replace(/"/g, '""')}"` : '';
        return [
            entry.gameId, entry.turn, entry.playerIndex, `"${entry.playerName.replace(/"/g, '""')}"`, entry.action, cardsStr,
            details.rank ?? '', details.qty ?? '', details.wilds ?? '', details.style ?? '', entry.handSizeBefore,
            `"${entry.passedPlayersBefore?.join(';') ?? ''}"`, entry.lastPlayRank ?? '', entry.lastPlayQty ?? '',
            `"${(details.reason ?? '').replace(/"/g, '""')}"`, details.winner ?? '',
            details.p2Threshold ?? '', details.wildPassThreshold ?? '',
            details.rule4RankThreshold ?? '' // Added data point
        ].join(',');
    });
    return `${headers.join(',')}\n${rows.join('\n')}`;
}
function handleExportLogs() { /* ... */ const resultsTextArea = document.getElementById('exported-logs-textarea'); const exportButton = document.getElementById('export-logs-button'); if (!resultsTextArea || !exportButton) { console.error("Export control elements not found."); return; } exportButton.disabled = true; resultsTextArea.value = "Generating CSV data..."; setTimeout(() => { const csvData = formatAllLogsForSheet(allGamesDetailedLog); resultsTextArea.value = csvData; exportButton.disabled = false; console.log("Log export complete. Data displayed."); }, 50); }

// --- Global Event Listeners ---
document.addEventListener('DOMContentLoaded', () => { /* ... Unchanged ... */ initializeGame(false); showPage('rules-page'); const newGameButton = document.getElementById('new-game-button'); if (newGameButton) { newGameButton.addEventListener('click', () => initializeGame(true)); } else { console.error("New Game button not found"); } const playButton = document.getElementById('play-button'); const passButton = document.getElementById('pass-button'); const clearButton = document.getElementById('clear-selection-button'); const aiReasoningToggle = document.getElementById('ai-reasoning-toggle'); const gameBoard = document.getElementById('game-board'); if (playButton) { playButton.addEventListener('click', handlePlayAction); } else { console.error("Play button not found"); } if (passButton) { passButton.addEventListener('click', handlePassAction); } else { console.error("Pass button not found"); } if (clearButton) { clearButton.addEventListener('click', handleClearSelection); } else { console.error("Clear Selection button not found"); } if (aiReasoningToggle && gameBoard) { aiReasoningToggle.addEventListener('change', (event) => { if (event.target.checked) { gameBoard.classList.add('show-ai-reasoning'); console.log("AI Reasoning: Shown"); } else { gameBoard.classList.remove('show-ai-reasoning'); console.log("AI Reasoning: Hidden"); } }); } else { console.error("AI Reasoning Toggle or Game Board element not found."); } const exportButton = document.getElementById('export-logs-button'); if (exportButton) { exportButton.addEventListener('click', handleExportLogs); } else { console.error("Export button not found"); } const startGameButton = document.getElementById('start-game-button'); if (startGameButton) { startGameButton.addEventListener('click', () => showPage('game-page')); } else { console.error("Start Game button not found"); } const showRulesButton = document.getElementById('show-rules-button'); if (showRulesButton) { showRulesButton.addEventListener('click', () => showPage('rules-page')); } else { console.error("Show Rules button not found"); } });