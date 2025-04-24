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
const ROYAL_VALUE_THRESHOLD = 11;
const WILD_PENALTY = 5;
const STARTING_ROUND_LOW_WILD_PENALTY = 20;
const AI_TURN_DELAY = 1000;
const AI_REASONING_DELAY = 300;
const ROUND_END_DELAY = AI_TURN_DELAY * 2;
const STANDARD_ROUND_END_DELAY = AI_TURN_DELAY * 1.5;
const FALLING_BEHIND_DIFF_P4 = 5; // For 3+ players
const FALLING_BEHIND_DIFF_1V1 = 3; // Threshold for 1v1
const LEAVE_ONE_CARD_PENALTY = 50;
const AVG_SCORE_CATCHUP_THRESHOLD = 0.9;
const ENDGAME_THRESHOLD = 6;
const ENDGAME_SINGLE_THRESHOLD = 2;
const ENDGAME_UNNECESSARY_WILD_PENALTY = 15;
const MIN_CARDS_FOR_WILD_PASS_RULE = 12;

// --- Dynamic Game Variables ---
let dynamicP2Threshold; // Threshold for "Stop Opponent" logic
let dynamicWildcardPassThreshold; // % of wilds used to trigger Rule 5 pass
let dynamicRule4RankThreshold; // Max rank for Rule 4 refinement

// --- Computer Player Names ---
const COMPUTER_NAMES = [
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
    gameMode: '3player', // '3player' or '1v1' - Default can be anything, will be set by initializeGame
    deck: [],
    players: [], // Will be populated based on gameMode
    currentPlayerIndex: -1,
    lastPlayedHand: null,
    passedPlayers: [],
    isGameOver: false,
    winner: null,
    isGameStarted: false,
    turnCount: 0,
    playedCards: {}, // Tracks count of non-wild ranks played
    unusedCards: [] // For 1v1 mode
};
let selectedCards = []; // Cards selected by the human player

// --- Session Statistics ---
let totalGamesPlayed = 0;
let userWins = 0;

// --- Logging State (Optional) ---
let gameCounter = 0;
let allGamesDetailedLog = [];
let currentGameDetailedLog = [];


// --- Core Functions ---

/**
 * Creates a card object.
 * @param {string | null} suit - The suit (hearts, diamonds, clubs, spades) or null for Jokers.
 * @param {string} rank - The rank (4-10, J, Q, K, A, 2, 3, Joker).
 * @returns {object} The card object.
 */
function createCard(suit, rank) {
    const isWild = WILD_RANKS.includes(rank);
    let displayRank = rank;
    let displaySuit = suit ? SUIT_SYMBOLS[suit] : '';
    // Unique ID for each card, especially Jokers
    let id = rank === "Joker" ? `Joker-${Math.random().toString(36).substr(2, 5)}` : `${rank}-${suit}`;
    if (rank === "Joker") {
        displayRank = "Joker";
        displaySuit = ""; // Jokers don't have a suit symbol
    }
    return {
        id: id,
        suit: suit,
        rank: rank,
        value: RANK_VALUES[rank],
        isWild: isWild,
        display: `${displayRank}${displaySuit}`
    };
}

/**
 * Creates a standard 54-card deck (52 + 2 Jokers).
 * @returns {Array<object>} An array of card objects.
 */
function createDeck() {
    const deck = [];
    // Add numbered cards (4-10), face cards (J, Q, K, A)
    for (const suit of SUITS) {
        for (let i = 4; i <= 14; i++) { // 4 through Ace (14)
            let rank;
            if (i <= 10) rank = String(i);
            else if (i === 11) rank = "J";
            else if (i === 12) rank = "Q";
            else if (i === 13) rank = "K";
            else if (i === 14) rank = "A";
            deck.push(createCard(suit, rank));
        }
        // Add wildcards (2, 3) for each suit
        deck.push(createCard(suit, "2"));
        deck.push(createCard(suit, "3"));
    }
    // Add Jokers
    deck.push(createCard(null, "Joker"));
    deck.push(createCard(null, "Joker"));
    return deck;
}

/**
 * Shuffles an array of cards in place using Fisher-Yates algorithm.
 * @param {Array<object>} deck - The deck of cards to shuffle.
 */
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap elements
    }
}

/**
 * Deals cards evenly to players in 3-player mode.
 * @param {Array<object>} deck - The shuffled deck of cards.
 * @param {Array<object>} players - The array of player objects.
 */
function dealCards3Player(deck, players) {
    let playerIndex = 0;
    while (deck.length > 0) {
        const card = deck.pop();
        if (card && players[playerIndex]) {
            players[playerIndex].hand.push(card);
        }
        playerIndex = (playerIndex + 1) % players.length;
    }
    players.forEach(player => sortHand(player.hand));
}

/**
 * Deals 18 cards each in 1v1 mode, ensuring 4 of Hearts is dealt.
 * @param {Array<object>} deck - The shuffled deck of cards.
 * @param {Array<object>} players - The array of player objects (should be 2).
 */
function dealCards1v1(deck, players) {
    if (players.length !== 2) {
        console.error("dealCards1v1 requires exactly 2 players.");
        return;
    }

    // Find and remove the 4 of Hearts
    let fourOfHeartsIndex = deck.findIndex(card => card.rank === '4' && card.suit === 'hearts');
    let fourOfHeartsCard = null;
    if (fourOfHeartsIndex !== -1) {
        fourOfHeartsCard = deck.splice(fourOfHeartsIndex, 1)[0];
    } else {
        console.error("CRITICAL ERROR: 4 of Hearts not found in the deck during 1v1 deal!");
        // Fallback: create the card if missing (should not happen with standard deck)
        fourOfHeartsCard = createCard('hearts', '4');
    }

    // Shuffle the remaining deck
    shuffleDeck(deck);

    // Deal 17 cards to each player from the remaining deck
    for (let i = 0; i < 17; i++) {
        if (deck.length > 0) players[0].hand.push(deck.pop());
        if (deck.length > 0) players[1].hand.push(deck.pop());
    }

    // Randomly assign the 4 of Hearts
    const recipientIndex = Math.floor(Math.random() * 2); // 0 or 1
    players[recipientIndex].hand.push(fourOfHeartsCard);
    console.log(`4 of Hearts dealt to Player ${recipientIndex}`);


    // Sort hands
    players.forEach(player => sortHand(player.hand));

    // Store unused cards
    gameState.unusedCards = [...deck]; // The rest of the deck is unused
    console.log(`1v1 Deal: ${players[0].hand.length} cards to P0, ${players[1].hand.length} cards to P1. ${gameState.unusedCards.length} unused.`);
}


/**
 * Sorts a player's hand based on rank value, then suit order.
 * @param {Array<object>} hand - The hand to sort.
 */
function sortHand(hand) {
    if (!hand) return;
    hand.sort((a, b) => {
        const valueA = a.value || 0; // Handle potential null/undefined values gracefully
        const valueB = b.value || 0;
        if (valueA !== valueB) {
            return valueA - valueB; // Sort by rank value first
        }
        // If ranks are equal, sort by suit (or null for Jokers)
        const suitOrder = { hearts: 1, diamonds: 2, clubs: 3, spades: 4, null: 5 }; // Jokers (null suit) last
        return (suitOrder[a.suit] || suitOrder.null) - (suitOrder[b.suit] || suitOrder.null);
    });
}

// --- AI Score Calculation (Used for Confident/Conservative logic) ---
function calculateHandRank(hand) {
    if (!hand || hand.length === 0) return 0;
    let score = 0;
    const rankCounts = {};
    const basePoints = { A: 10, K: 8, Q: 6, J: 4, '10': 3, '9': 2, '8': 1 }; // Points for non-wilds
    const wildPoints = { Joker: 5, '2': 4, '3': 4 }; // Points for wilds

    for (const card of hand) {
        if (card.isWild) {
            score += wildPoints[card.rank] || 0;
        } else {
            score += basePoints[card.rank] || 0;
            rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
        }
    }
    // Bonus points for sets
    for (const rank in rankCounts) {
        const count = rankCounts[rank];
        const rankValue = RANK_VALUES[rank];
        if (count >= 2) { score += (10 + Math.ceil(rankValue / 2)); } // Pair bonus
        if (count >= 3) { score += (15 + rankValue); } // Triple bonus
        if (count >= 4) { score += (15 + Math.ceil(rankValue * 1.5)); } // Quad bonus
    }
    return score;
}
function calculateAvgScore(hand) {
    if (!hand || hand.length === 0) return 0;
    const totalScore = calculateHandRank(hand);
    return totalScore / hand.length;
}

// --- Helper: Get Rank Name ---
function getRankName(rankValue) {
    switch (rankValue) {
        case 4: return "FOUR"; case 5: return "FIVE"; case 6: return "SIX"; case 7: return "SEVEN";
        case 8: return "EIGHT"; case 9: return "NINE"; case 10: return "TEN"; case 11: return "JACK";
        case 12: return "QUEEN"; case 13: return "KING"; case 14: return "ACE"; default: return "UNKNOWN";
    }
}

// --- AI Reasoning Text Generation ---
function generateReasoningText(playStyle, chosenPlay = null, opponentHandSize = null) {
    let reason = "Thinking...";
    const p2Threshold = dynamicP2Threshold; // Use dynamic threshold

    if (playStyle.startsWith('pass_')) {
        const reasonCode = playStyle.substring(5);
        switch (reasonCode) {
            case 'no_valid': reason = "Passed: No valid plays were available."; break;
            case 'confident': reason = "Passed: Had a valid play, but chose to pass while feeling confident."; break;
            case 'conservative': reason = "Passed: Had a valid play, but chose to pass to be more conservative."; break;
            case 'falling_behind': reason = "Passed: Could not find a suitable play to catch up (match or increase quantity)."; break;
            case 'stop_opponent': reason = `Passed: Could not find a play to stop opponent (hand <= ${p2Threshold}).`; break; // Include threshold
            case 'no_4h_play_chosen': reason = "Passed: Error - Had 4♥ but couldn't select a valid play."; break;
            case 'invalid_win_forced_pass': reason = "Passed: Intended winning play was invalid (contained Ace/Wild)."; break;
            case 'internal_error': reason = "Passed: Internal error occurred during decision making."; break;
            case 'strategic_high_wild_usage': reason = `Passed: Strategic Rule 5 - Play considered used too high % of available wildcards.`; break;
            default: reason = "Passed: No suitable play found based on current strategy.";
        }
    } else if (chosenPlay) {
        const rankName = getRankName(chosenPlay.rankValue);
        const plural = chosenPlay.quantity > 1 ? 'S' : '';
        const playDesc = `${chosenPlay.quantity}x ${rankName}${plural}`;
        const wildInfo = chosenPlay.usesWilds ? " (using wildcards)" : "";
        switch (playStyle) {
            case 'winning': reason = `Played ${playDesc}${wildInfo} to win the game!`; break;
            case 'penultimate': reason = `Played ${playDesc}${wildInfo} to set up a potential win next turn.`; break;
            case 'penultimate_lower_rank': reason = `Played lower rank ${playDesc}${wildInfo} to set up a potential win next turn.`; break;
            case 'stop_opponent': reason = `Played ${playDesc}${wildInfo} aggressively as an opponent has <= ${p2Threshold} cards.`; break; // Include threshold
            // --- Falling Behind Reasons ---
            case 'falling_behind_match_qty_with_wilds':
            case 'falling_behind_match_qty_no_wilds': reason = `Played ${playDesc}${wildInfo} to match quantity and reduce hand size (currently falling behind).`; break;
            case 'falling_behind_increase_qty_no_wilds': reason = `Played ${playDesc}${wildInfo} (no wilds) to increase quantity and reduce hand size (currently falling behind).`; break;
            // --- End Falling Behind ---
            case 'confident_with_wilds': case 'confident_no_wilds': reason = `Played ${playDesc}${wildInfo} confidently while ahead or level.`; break;
            case 'conservative_with_wilds': case 'conservative_no_wilds': reason = `Played ${playDesc}${wildInfo} cautiously, trying to save stronger cards.`; break;
            case 'conservative_rank_plus_3': reason = `Played ${playDesc}${wildInfo} as a safe, non-royal, non-wild +3 rank play.`; break;
            case 'confident_ace_start_swap_no_wild': case 'conservative_ace_start_swap_no_wild': reason = `Played ${playDesc}${wildInfo} instead of lowest single to avoid using it when starting with an Ace.`; break;
            case 'start_4h': reason = `Played ${playDesc}${wildInfo} to start the game (must include 4♥).`; break;
            // --- Strategic Override Reasons ---
            case 'strategic_override_low_no_wild': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 4: Refined play to low non-wild below ${dynamicRule4RankThreshold}).`; break; // Include threshold
            case 'strategic_override_ace': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 1: Override pass with single Ace).`; break;
            case 'strategic_override_ace_wild': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 1: Override pass with Ace + Wilds).`; break;
            case 'strategic_override_low_wild': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 2: Override pass with low non-wild + wild).`; break;
            case 'strategic_override_second_low': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 3: Play second lowest single instead of lowest at start).`; break;
            case 'strategic_override_lowest_nw': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 6: Play lowest non-wild instead of pass).`; break;
            case 'strategic_override_lowest_nw_wild': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 6: Play lowest non-wild using wilds instead of pass).`; break;
            case 'strategic_override_below_jack_nw': reason = `Strategically Played: ${playDesc}${wildInfo} (Rule 6: Play non-wild below Jack instead of pass).`; break;
            default: reason = `Played ${playDesc}${wildInfo}. Strategy: ${playStyle}.`;
         }
     }
    return reason;
}

// --- Rendering Functions ---

/**
 * Creates a DOM element for a card.
 * @param {object} card - The card object.
 * @returns {HTMLElement} The card div element.
 */
function renderCard(card) {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    cardElement.dataset.cardId = card.id; // Use the unique card ID
    cardElement.textContent = card.display;
    // Set color based on suit
    cardElement.style.color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
    if (card.rank === 'Joker') {
        cardElement.style.fontWeight = 'bold'; // Make Jokers stand out
    }
    return cardElement;
}

/**
 * Renders all player hands and updates player area styles.
 */
function renderHands() {
    const players = gameState.players;
    const mode = gameState.gameMode;
    const isGameOver = gameState.isGameOver;
    const passedPlayerIndices = gameState.passedPlayers;
    const currentPlayerIndex = gameState.currentPlayerIndex;

    players.forEach((player, index) => {
        const isHuman = index === 0;
        const playerSuffix = mode === '1v1' ? '-1v1' : '-3p'; // Suffix for element IDs

        // --- Get Element IDs based on mode ---
        let playerAreaId, handContainerId, countElementId, nameElementId;
        let wildsContainerId, lowContainerId, royalsContainerId; // Human specific
        let reasoningElementId; // Computer specific
        let baseComputerPrefix = ''; // 'c1' or 'c2'

        if (isHuman) {
            playerAreaId = `human-player${playerSuffix}`;
            handContainerId = `p1-hand${playerSuffix}`; // Main container for hand groups
            wildsContainerId = `p1-hand-wilds${playerSuffix}`;
            lowContainerId = `p1-hand-low${playerSuffix}`;
            royalsContainerId = `p1-hand-royals${playerSuffix}`;
            countElementId = `p1-count${playerSuffix}`;
        } else { // Computer Player
            // Determine the base prefix ('c1' or 'c2')
            baseComputerPrefix = (mode === '1v1' || index === 1) ? 'c1' : 'c2';

            // Construct IDs using the base prefix and mode suffix
            playerAreaId = (mode === '1v1' || index === 1) ? `computer-1${playerSuffix}` : `computer-2${playerSuffix}`; // Outer container ID uses computer-1/2
            handContainerId = `${baseComputerPrefix}-hand${playerSuffix}`;         // Corrected ID construction
            countElementId = `${baseComputerPrefix}-count${playerSuffix}`;        // Corrected ID construction
            reasoningElementId = `${baseComputerPrefix}-reasoning${playerSuffix}`; // Corrected ID construction
            nameElementId = `${baseComputerPrefix}-name${playerSuffix}`;           // Corrected ID construction
        }

        // --- Get Elements ---
        const playerAreaElement = document.getElementById(playerAreaId);
        const countElement = document.getElementById(countElementId);
        const handContainerElement = document.getElementById(handContainerId); // Main hand div or specific computer hand div

        // Check if essential elements exist for the player before proceeding
        if (!playerAreaElement || !countElement || !handContainerElement) {
             // Log warning only if the player actually exists in the gameState
             if (player) {
                 console.warn(`Render warning: Missing elements for player ${index} (ID: ${player.id}, Name: ${player.name}) in mode ${mode}. Searched IDs: Area=${playerAreaId}, Count=${countElementId}, Hand=${handContainerId}`);
             }
             return; // Skip rendering this player if elements are missing
        }


        // --- Update Player Name (Computers) ---
        if (nameElementId) {
            const playerNameElement = document.getElementById(nameElementId);
            if (playerNameElement && player.name) {
                playerNameElement.textContent = player.name;
            } else if (!playerNameElement) {
                 console.warn(`Render warning: Name element not found for ID: ${nameElementId}`);
            }
        }

        // --- Render Hand ---
        if (isHuman) {
            const wildsContainer = document.getElementById(wildsContainerId);
            const lowContainer = document.getElementById(lowContainerId);
            const royalsContainer = document.getElementById(royalsContainerId);
            if (!wildsContainer || !lowContainer || !royalsContainer) {
                 console.warn(`Render warning: Missing human hand group containers for mode ${mode}`);
                 return; // Stop rendering human hand if groups missing
            }

            wildsContainer.innerHTML = '';
            lowContainer.innerHTML = '';
            royalsContainer.innerHTML = '';

            if (player.hand) {
                sortHand(player.hand); // Ensure hand is sorted before rendering
                player.hand.forEach(card => {
                    const cardEl = renderCard(card);
                    const isSelected = selectedCards.some(selectedCard => selectedCard.id === card.id);

                    // Add click listener only if it's human's turn and game not over/passed
                    if (currentPlayerIndex === index && !isGameOver && !passedPlayerIndices.includes(index)) {
                        cardEl.addEventListener('click', handleCardClick);
                        if (isSelected) {
                            cardEl.classList.add('selected');
                        }
                    } else {
                        cardEl.style.cursor = 'default'; // Not clickable
                        if (isSelected) {
                            cardEl.classList.add('selected'); // Still show selection if game ends etc.
                        }
                    }

                    // Append to correct group
                    if (card.isWild) {
                        wildsContainer.appendChild(cardEl);
                    } else if (card.value < ROYAL_VALUE_THRESHOLD) {
                        lowContainer.appendChild(cardEl);
                    } else {
                        royalsContainer.appendChild(cardEl);
                    }
                });
            }
            countElement.textContent = player.hand?.length ?? 0;

        } else { // Computer Hand Rendering
            const reasoningElement = document.getElementById(reasoningElementId);
            handContainerElement.innerHTML = ''; // Clear previous cards/backs

            if (isGameOver && player.hand && player.hand.length > 0) {
                // Show computer's final hand if game is over
                sortHand(player.hand);
                player.hand.forEach(card => {
                    const cardEl = renderCard(card);
                    cardEl.style.cursor = 'default';
                    handContainerElement.appendChild(cardEl);
                });
            } else if (!isGameOver && player.hand) {
                // Show card backs if game is ongoing
                player.hand.forEach(_ => {
                    const cardEl = document.createElement('div');
                    cardEl.classList.add('card', 'card-back');
                    handContainerElement.appendChild(cardEl);
                });
            }
            countElement.textContent = player.hand?.length ?? 0;

            // Update Reasoning Display
            if (reasoningElement) {
                const reasoningParagraph = reasoningElement.querySelector('p');
                if (reasoningParagraph) {
                    let reasonText = player.lastReasoning || "Waiting...";
                    // Show "Thinking..." if it's their turn but reasoning hasn't been generated yet
                    if (currentPlayerIndex === index && !isGameOver && !passedPlayerIndices.includes(index) && !player.lastReasoning) {
                        reasonText = "Thinking...";
                    }
                    reasoningParagraph.textContent = reasonText;
                }
            } else {
                 console.warn(`Render warning: Reasoning element not found for ID: ${reasoningElementId}`);
            }
        }

        // --- Update Player Area Styles (Win/Pass/Highlight) ---
        if (playerAreaElement) {
            // Winner highlight
            if (isGameOver && gameState.winner === index) {
                playerAreaElement.classList.add('player-wins');
            } else {
                playerAreaElement.classList.remove('player-wins');
            }
            // Passed highlight
            if (!isGameOver && passedPlayerIndices.includes(index)) {
                playerAreaElement.classList.add('player-passed');
            } else {
                playerAreaElement.classList.remove('player-passed');
            }
            // Current player highlight
            if (currentPlayerIndex === index && !isGameOver && !passedPlayerIndices.includes(index)) {
                playerAreaElement.classList.add('current-player');
            } else {
                playerAreaElement.classList.remove('current-player');
            }
        }
    });
}


/**
 * Renders the last played hand in the central play area.
 * @param {object | null} playedHand - The last played hand object, or null to clear.
 */
function renderPlayArea(playedHand) {
    const mode = gameState.gameMode;
    const playAreaElement = document.getElementById(`last-played${mode === '1v1' ? '-1v1' : '-3p'}`);
    const descriptionElement = document.getElementById(`last-played-description${mode === '1v1' ? '-1v1' : '-3p'}`);

    if (!playAreaElement || !descriptionElement) {
        console.warn(`Render warning: Missing play area elements for mode ${mode}`);
        return;
    }

    playAreaElement.innerHTML = ''; // Clear previous cards
    descriptionElement.textContent = ''; // Clear description

    if (playedHand && playedHand.cards && playedHand.cards.length > 0) {
        sortHand(playedHand.cards); // Ensure cards are sorted
        playedHand.cards.forEach(card => {
            const cardElement = renderCard(card);
            cardElement.style.cursor = 'default'; // Played cards aren't interactive
            playAreaElement.appendChild(cardElement);
        });

        // Update description
        const quantity = playedHand.quantity;
        const rankValue = playedHand.rankValue;
        const rankName = getRankName(rankValue);
        const plural = quantity > 1 ? 'S' : '';
        descriptionElement.textContent = `${quantity}x ${rankName}${plural}`;
    }
}

/**
 * Updates the status message display.
 * @param {string} message - The message to display.
 */
function updateStatus(message) {
    const mode = gameState.gameMode;
    // Use the mode determined at the start of the current game, or default if somehow unknown
    const currentModeSuffix = (gameState.gameMode === '1v1') ? '-1v1' : '-3p';
    const statusElement = document.getElementById(`status-message${currentModeSuffix}`);
    if (statusElement) {
        statusElement.textContent = message;
    } else {
         console.warn(`updateStatus: Status element not found for suffix ${currentModeSuffix}`);
         // Fallback: try updating both? Or log error.
         const status3p = document.getElementById('status-message-3p');
         const status1v1 = document.getElementById('status-message-1v1');
         if(status3p) status3p.textContent = message;
         if(status1v1) status1v1.textContent = message;
    }
}

/**
 * Adds a log entry for a play action to the play log area.
 * @param {number} playerIndex - Index of the player who played.
 * @param {object} playedHand - The hand that was played.
 */
function logPlay(playerIndex, playedHand) {
    const mode = gameState.gameMode;
    const logArea = document.getElementById(`play-log${mode === '1v1' ? '-1v1' : '-3p'}`);
    if (!logArea) return;

    const playerName = gameState.players[playerIndex]?.name ?? `Player ${playerIndex + 1}`;
    sortHand(playedHand.cards); // Ensure consistent display order
    const cardDisplays = playedHand.cards.map(c => c.display).join(', ');

    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry');
    logEntry.textContent = `${playerName} played: ${cardDisplays}`;
    logArea.prepend(logEntry); // Add new entries to the top
}

/**
 * Adds a general event log entry (like pass, round end) to the play log area.
 * @param {string} message - The event message.
 * @param {string} type - The type of event ('info', 'pass', 'round-end').
 */
function logEvent(message, type = 'info') {
    const mode = gameState.gameMode;
    const logArea = document.getElementById(`play-log${mode === '1v1' ? '-1v1' : '-3p'}`);
    if (!logArea) return;

    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry', `log-event-${type}`);
    logEntry.textContent = `--- ${message} ---`;
    logArea.prepend(logEntry);
}

// --- Page Navigation & Card Selection ---

/**
 * Shows the specified page and hides others. Also manages the top navigation visibility.
 * @param {string} pageIdToShow - The ID of the page container div to show.
 */
function showPage(pageIdToShow) {
    const pageIds = ['mode-selection-page', 'rules-page', 'game-page-3player', 'game-page-1v1'];
    const navSetIds = ['nav-mode-selection', 'nav-rules', 'nav-3player', 'nav-1v1'];
    let navIdToShow = 'nav-mode-selection'; // Default nav state

    // Hide all pages and nav sets first
    pageIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    navSetIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });

    // Determine which nav set to show based on the page
    if (pageIdToShow === 'rules-page') {
        navIdToShow = 'nav-rules';
    } else if (pageIdToShow === 'game-page-3player') {
        navIdToShow = 'nav-3player';
    } else if (pageIdToShow === 'game-page-1v1') {
        navIdToShow = 'nav-1v1';
    }
    // For 'mode-selection-page', navIdToShow remains 'nav-mode-selection' (which is empty/hidden)

    // Show the target page
    const pageElement = document.getElementById(pageIdToShow);
    if (pageElement) {
        pageElement.style.display = 'block';
    } else {
        console.error(`showPage: Page element not found for ID: ${pageIdToShow}`);
    }

    // Show the corresponding nav set
    const navElement = document.getElementById(navIdToShow);
    if (navElement) {
        navElement.style.display = 'block'; // Or 'flex', 'inline-block' depending on CSS
    } else {
         console.error(`showPage: Nav element not found for ID: ${navIdToShow}`);
    }


    window.scrollTo(0, 0); // Scroll to top when changing pages
    console.log(`Showing page: ${pageIdToShow}, Nav: ${navIdToShow}`);
}

/**
 * Handles clicks on cards in the human player's hand.
 * MODIFIED: Deselection now only removes the clicked card.
 * @param {Event} event - The click event object.
 */
function handleCardClick(event) {
    // Prevent action if game over, not human's turn, or human has passed
    if (gameState.isGameOver || gameState.currentPlayerIndex !== 0 || gameState.passedPlayers.includes(0)) {
        return;
    }

    const clickedCardElement = event.target.closest('.card');
    if (!clickedCardElement) return;

    const clickedCardId = clickedCardElement.dataset.cardId;
    if (!clickedCardId) return;

    // Find the card object in the player's hand using the unique ID
    const clickedCardObject = gameState.players[0]?.hand?.find(c => c.id === clickedCardId);
    if (!clickedCardObject) return;

    const isClickedCardSelected = selectedCards.some(c => c.id === clickedCardId);

    if (isClickedCardSelected) {
        // --- MODIFIED BEHAVIOR ---
        // If the clicked card is already selected, *only* deselect that specific card.
        selectedCards = selectedCards.filter(c => c.id !== clickedCardId);
    } else {
        // --- ORIGINAL SELECTION BEHAVIOR ---
        // If the clicked card is *not* selected:
        const isClickedCardWild = clickedCardObject.isWild;
        if (isClickedCardWild) {
            // Select wildcards individually
            selectedCards.push(clickedCardObject);
        } else {
            // Select all cards of the same non-wild rank
            const rankToMatch = clickedCardObject.rank;
            const cardsOfSameRank = gameState.players[0].hand.filter(
                card => !card.isWild && card.rank === rankToMatch
            );
            const currentSelectedIds = new Set(selectedCards.map(c => c.id));
            cardsOfSameRank.forEach(card => {
                if (!currentSelectedIds.has(card.id)) {
                    selectedCards.push(card);
                }
            });
        }
    }

    renderHands(); // Re-render hands to show selection changes
    console.log("Selected cards:", selectedCards.map(c => c.display).join(', '));
}


/**
 * Handles the click of the "Clear Selection" button.
 */
function handleClearSelection() {
    if (gameState.isGameOver || gameState.currentPlayerIndex !== 0) return; // Only allow if it's player's turn

    if (selectedCards.length > 0) {
        console.log("Clear Selection button clicked.");
        selectedCards = [];
        renderHands(); // Re-render to remove selection highlights
    }
}

// --- Logging & Game State ---

/**
 * Logs detailed turn information for analysis/debugging.
 * @param {string} actionType - Type of action (e.g., 'play', 'pass', 'game_start').
 * @param {object} details - Additional context for the action.
 */
function logDetailedTurn(actionType, details = {}) {
    // Ensure currentPlayerIndex is valid before logging
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) {
        // console.warn("logDetailedTurn: Invalid currentPlayerIndex", gameState.currentPlayerIndex);
        // Log basic info if possible
         const entry = { gameId: gameCounter, mode: gameState.gameMode, turn: gameState.turnCount, playerIndex: gameState.currentPlayerIndex, action: actionType, details: details };
         currentGameDetailedLog.push(entry);
        return;
    }
    const entry = {
        gameId: gameCounter,
        mode: gameState.gameMode, // Log the mode
        turn: gameState.turnCount,
        playerIndex: gameState.currentPlayerIndex,
        playerName: currentPlayer.name || 'N/A',
        action: actionType,
        handSizeBefore: currentPlayer.hand?.length || 0,
        passedPlayersBefore: [...gameState.passedPlayers],
        lastPlayRank: gameState.lastPlayedHand?.rankValue || null,
        lastPlayQty: gameState.lastPlayedHand?.quantity || null,
        details: details
    };
    currentGameDetailedLog.push(entry);
    // console.log("Detailed Log:", entry); // Optional: Log to console
}

/**
 * Tracks the count of each non-wild rank played during the game.
 * @param {object} playedHand - The hand that was played.
 */
function trackPlayedCards(playedHand) {
    if (!playedHand || !playedHand.cards) return;
    for (const card of playedHand.cards) {
        if (!card.isWild) {
            const rank = card.rank;
            gameState.playedCards[rank] = (gameState.playedCards[rank] || 0) + 1;
        }
    }
    // console.log("Played card counts:", gameState.playedCards); // Optional debug log
}

// --- Update Stats Display ---
function updateStatsDisplay() {
    const gamesPlayedEl = document.getElementById('stats-games-played');
    const gamesWonEl = document.getElementById('stats-games-won');
    const winPercentEl = document.getElementById('stats-win-percentage');
    // Also update 1v1 stats elements if they exist (using same data for now)
    const gamesPlayedEl1v1 = document.getElementById('stats-games-played-1v1');
    const gamesWonEl1v1 = document.getElementById('stats-games-won-1v1');
    const winPercentEl1v1 = document.getElementById('stats-win-percentage-1v1');


    if (gamesPlayedEl) gamesPlayedEl.textContent = totalGamesPlayed;
    if (gamesWonEl) gamesWonEl.textContent = userWins;
    if (gamesPlayedEl1v1) gamesPlayedEl1v1.textContent = totalGamesPlayed;
    if (gamesWonEl1v1) gamesWonEl1v1.textContent = userWins;


    if (winPercentEl) {
        if (totalGamesPlayed > 0) {
            const winPercentage = ((userWins / totalGamesPlayed) * 100).toFixed(1);
            winPercentEl.textContent = `${winPercentage}%`;
        } else {
            winPercentEl.textContent = 'N/A';
        }
    }
     if (winPercentEl1v1) {
        if (totalGamesPlayed > 0) {
            const winPercentage = ((userWins / totalGamesPlayed) * 100).toFixed(1);
            winPercentEl1v1.textContent = `${winPercentage}%`;
        } else {
            winPercentEl1v1.textContent = 'N/A';
        }
    }
}

/**
 * Declares the winner, updates game state and stats.
 * @param {number} winnerIndex - The index of the winning player.
 */
function declareWinner(winnerIndex) {
    if (gameState.isGameOver) return; // Prevent multiple declarations

    const winnerName = gameState.players[winnerIndex]?.name ?? `Player ${winnerIndex + 1}`;
    updateStatus(`${winnerName} won!`);
    gameState.isGameOver = true;
    gameState.winner = winnerIndex;

    // --- Update stats ---
    // Increment games played only when a game officially ends (winner declared)
    // totalGamesPlayed++; // Moved to initializeGame to count starts
    if (winnerIndex === 0) { // Check if the human player won
        userWins++;
    }
    updateStatsDisplay(); // Update display after win/loss

    logDetailedTurn('game_end', { winner: winnerIndex });
    // Optional: Keep detailed logging if needed for other purposes
    allGamesDetailedLog.push(...currentGameDetailedLog);

    // Disable action buttons for the current mode
    const mode = gameState.gameMode;
    const playButton = document.getElementById(`play-button${mode === '1v1' ? '-1v1' : '-3p'}`);
    const passButton = document.getElementById(`pass-button${mode === '1v1' ? '-1v1' : '-3p'}`);
    const clearButton = document.getElementById(`clear-selection-button${mode === '1v1' ? '-1v1' : '-3p'}`);
    if (playButton) playButton.disabled = true;
    if (passButton) passButton.disabled = true;
    if (clearButton) clearButton.disabled = true;

    renderHands(); // Show final hands and winner highlight
}

// --- Action Handlers ---

/**
 * Validates if a combination of selected cards forms a valid playable hand (same rank or wilds).
 * @param {Array<object>} cardsToCheck - The array of selected card objects.
 * @returns {object} { isValid: boolean, message?: string, rankValue?: number, quantity?: number }
 */
function validateSelectedCardsCombo(cardsToCheck) {
    if (!cardsToCheck || cardsToCheck.length === 0) {
        return { isValid: false, message: "No cards selected." };
    }

    const nonWildCards = cardsToCheck.filter(c => !c.isWild);

    if (nonWildCards.length === 0) {
        // Cannot play *only* wild cards
        return { isValid: false, message: "Cannot play only wild cards." };
    }

    // All non-wild cards must be of the same rank
    const firstRankValue = nonWildCards[0].value;
    const allSameRank = nonWildCards.every(c => c.value === firstRankValue);

    if (!allSameRank) {
        return { isValid: false, message: "Selected cards must be the same rank (or wildcards)." };
    }

    // If valid, return details
    return {
        isValid: true,
        rankValue: firstRankValue,
        quantity: cardsToCheck.length
    };
}

/**
 * Handles the "Play Selected" button click for the human player.
 */
function handlePlayAction() {
    console.log("Play button clicked.");
    if (gameState.isGameOver) {
        updateStatus("Game is over.");
        return;
    }
    if (gameState.currentPlayerIndex !== 0) {
        updateStatus("It's not your turn.");
        return;
    }
    if (gameState.passedPlayers.includes(0)) {
        updateStatus("You have passed for this round.");
        return;
    }

    // 1. Validate the selected cards form a valid combo (same rank + wilds)
    const comboValidation = validateSelectedCardsCombo(selectedCards);
    if (!comboValidation.isValid) {
        updateStatus(`Invalid play: ${comboValidation.message}`);
        return;
    }

    const { rankValue: playedRankValue, quantity: playedQuantity } = comboValidation;
    sortHand(selectedCards); // Sort for consistency before creating play object
    const currentPlay = {
        cards: [...selectedCards], // Create a copy
        rankValue: playedRankValue,
        quantity: playedQuantity,
        playerIndex: 0, // Human player index
        usesWilds: selectedCards.some(c => c.isWild) // Check if wilds were used
    };

    const lastPlay = gameState.lastPlayedHand;

    // 2. Validate against game rules (first play, beating last play)
    if (!gameState.isGameStarted) {
        // First play of the entire game
        if (!lastPlay) { // Should always be null here, but check for safety
            // Must include 4 of Hearts
            if (!selectedCards.some(c => c.rank === '4' && c.suit === 'hearts')) {
                updateStatus("Invalid play: First play must include the 4 of Hearts.");
                return;
            }
            // gameState.isGameStarted = true; // Mark game as started // Moved to after successful play
        } else {
            // This case should theoretically not happen if isGameStarted is false
            console.error("Error: Game not started but lastPlayedHand exists.");
            updateStatus("Internal error. Please start a new game.");
            return;
        }
    } else {
        // Subsequent plays must beat the last played hand
        if (lastPlay) {
            if (!(currentPlay.rankValue > lastPlay.rankValue && currentPlay.quantity >= lastPlay.quantity)) {
                updateStatus(`Invalid play: Must play higher rank (${getRankName(currentPlay.rankValue)} vs ${getRankName(lastPlay.rankValue)}) with at least same quantity (${currentPlay.quantity} vs ${lastPlay.quantity}).`);
                return;
            }
        }
        // If lastPlay is null here, it means the player is starting a new round - any valid combo is allowed.
    }

    // 3. Validate final play (cannot contain Ace or Wilds if it empties hand)
    const playerHand = gameState.players[0]?.hand;
    if (!playerHand) return; // Should not happen
    const isWinningHand = playerHand.length === selectedCards.length;
    if (isWinningHand) {
        if (selectedCards.some(c => c.value === ACE_VALUE || c.isWild)) {
            updateStatus("Invalid play: Final hand cannot contain Aces or Wildcards.");
            return;
        }
    }

    // --- If all validations pass, execute the play ---
    logDetailedTurn('play', { cards: currentPlay.cards.map(c => c.display).join(';'), rank: currentPlay.rankValue, qty: currentPlay.quantity, wilds: currentPlay.usesWilds, style: 'human' });

     // Mark game started if this is the first play (4h)
    if (!gameState.isGameStarted && currentPlay.cards.some(c => c.rank === '4' && c.suit === 'hearts')) {
        gameState.isGameStarted = true;
        console.log("Game marked as started after Human played 4H.");
    }


    // Update game state
    gameState.lastPlayedHand = currentPlay;
    trackPlayedCards(currentPlay); // Track ranks played

    // Remove cards from player's hand
    const playedCardIds = new Set(selectedCards.map(card => card.id));
    gameState.players[0].hand = playerHand.filter(card => !playedCardIds.has(card.id));
    selectedCards = []; // Clear selection

    // Update UI
    logPlay(0, currentPlay); // Log the play
    renderPlayArea(gameState.lastPlayedHand);
    renderHands(); // Re-render hands (clears selection, updates counts)

    // Check for win condition
    if (gameState.players[0].hand.length === 0) {
        declareWinner(0);
        return; // Game over
    }

    // Check for Ace rule (round win)
    if (currentPlay.rankValue === ACE_VALUE) {
        logEvent("Aces played - Round Over!", "round-end");
        logDetailedTurn('round_end', { reason: 'ace', winner: 0 });
        updateStatus("Aces played! **You won the round!** Starting next...");
        // Start next round after a delay, human player (0) starts
        setTimeout(() => {
            startNextRound(0);
        }, ROUND_END_DELAY);
        return; // End turn early
    }

    // Advance to the next player
    updateStatus("Play successful. Advancing turn...");
    advanceTurn();
}

/**
 * Handles the "Pass" button click for the human player.
 */
function handlePassAction() {
    console.log("Pass button clicked.");
    if (gameState.isGameOver) {
        updateStatus("Game is over.");
        return;
    }
    if (gameState.currentPlayerIndex !== 0) {
        updateStatus("It's not your turn.");
        return;
    }
    if (gameState.passedPlayers.includes(0)) {
        updateStatus("You have already passed for this round.");
        return;
    }
    // Cannot pass before the game starts (4h not played)
    if (!gameState.isGameStarted) {
        updateStatus("Cannot pass before the first card (4♥) is played.");
        return;
    }
    // Cannot pass if you are starting the round or just played
    if (!gameState.lastPlayedHand || gameState.lastPlayedHand.playerIndex === 0) {
        updateStatus("Cannot pass when you start the round or just played.");
        return;
    }

    // --- Execute Pass ---
    const playerIndex = gameState.currentPlayerIndex; // Should be 0
    const playerName = gameState.players[playerIndex].name;

    if (!gameState.passedPlayers.includes(playerIndex)) {
        logDetailedTurn('pass', { reason: 'manual' });
        gameState.passedPlayers.push(playerIndex);
        logEvent(`${playerName} passed.`, 'pass');
    }

    selectedCards = []; // Clear selection if any
    renderHands(); // Update UI to show passed status

    // Check if the round is over after passing
    if (checkRoundOver()) {
        const roundWinnerIndex = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1;
        if (roundWinnerIndex !== -1 && gameState.players[roundWinnerIndex]) {
            const winnerName = gameState.players[roundWinnerIndex].name;
            logEvent(`${winnerName} wins the round (opponents passed).`, 'round-end');
            logDetailedTurn('round_end', { reason: 'pass', winner: roundWinnerIndex });
            updateStatus(`Round over! ${winnerName} wins the round. Starting next...`);
            // Start next round after a delay, winner starts
            setTimeout(() => {
                startNextRound(roundWinnerIndex);
            }, STANDARD_ROUND_END_DELAY);
        } else {
            // Should not happen if lastPlayedHand exists
            console.error("Round over after pass, but couldn't determine winner!");
            updateStatus("Error determining round winner. Advancing turn...");
            advanceTurn(); // Try to proceed?
        }
    } else {
        // Round not over, just advance turn
        updateStatus("You passed. Advancing turn...");
        advanceTurn();
    }
}


// --- AI Logic ---

/**
 * Finds all valid plays a player can make given their hand and the last played hand.
 * @param {Array<object>} hand - The player's current hand.
 * @param {object | null} lastPlayedHand - The last hand played in the round.
 * @param {boolean} isGameStartedSim - Whether the game has started (for simulation).
 * @returns {Array<object>} An array of valid play objects { cards, rankValue, quantity, usesWilds, id }.
 */
function findValidPlays(hand, lastPlayedHand, isGameStartedSim = gameState.isGameStarted) {
    const validPlays = [];
    if (!hand || hand.length === 0) return validPlays;

    const availableWilds = hand.filter(c => c.isWild);
    const nonWildsGroupedByRank = hand.filter(c => !c.isWild)
        .reduce((acc, card) => {
            if (!acc[card.rank]) acc[card.rank] = [];
            acc[card.rank].push(card);
            return acc;
        }, {});

    const lastRankValue = lastPlayedHand?.rankValue ?? -1; // -1 if no last hand
    const minQuantityNeeded = lastPlayedHand?.quantity ?? 1; // Need at least 1 card if starting

    // Iterate through each rank the player holds (non-wild)
    for (const rank in nonWildsGroupedByRank) {
        const nonWildCardsOfRank = nonWildsGroupedByRank[rank];
        const rankValue = nonWildCardsOfRank[0].value;

        // Optimization: If last hand exists, skip ranks that are not higher
        if (lastPlayedHand && rankValue <= lastRankValue) continue;

        const numNonWilds = nonWildCardsOfRank.length;
        const maxPossibleQuantity = numNonWilds + availableWilds.length;

        // Check all possible quantities from minimum needed up to max possible
        for (let quantity = minQuantityNeeded; quantity <= maxPossibleQuantity; quantity++) {
            const numNonWildsToUse = Math.min(quantity, numNonWilds);
            const wildsNeeded = quantity - numNonWildsToUse;

            // Check if enough wilds are available
            if (wildsNeeded >= 0 && wildsNeeded <= availableWilds.length) {
                // Construct the potential play
                const playCards = [
                    ...nonWildCardsOfRank.slice(0, numNonWildsToUse),
                    ...availableWilds.slice(0, wildsNeeded)
                ];

                // Double check quantity matches (should always be true here)
                if (playCards.length !== quantity) {
                     console.warn("Play construction quantity mismatch", quantity, playCards.length);
                     continue;
                }

                const potentialPlay = {
                    cards: playCards,
                    rankValue: rankValue,
                    quantity: quantity,
                    usesWilds: wildsNeeded > 0,
                    id: playCards.map(c=>c.id).sort().join('-') // Unique ID for the play combo
                };

                // Check if this play is valid against the last played hand
                if (isPlayValidVsLast(potentialPlay, lastPlayedHand)) {
                    validPlays.push(potentialPlay);
                }
            }
        }
    }

    // Special rule for the very first play of the game
    if (!isGameStartedSim && !lastPlayedHand) {
        // Filter valid plays to only include those containing the 4 of Hearts
        return validPlays.filter(p => p.cards.some(c => c.rank === '4' && c.suit === 'hearts'));
    }

    return validPlays;
}

/**
 * Checks if a potential play is valid against the last played hand.
 * @param {object} potentialPlay - The play being considered.
 * @param {object | null} lastPlayedHand - The last hand played.
 * @returns {boolean} True if the play is valid, false otherwise.
 */
function isPlayValidVsLast(potentialPlay, lastPlayedHand) {
    if (!lastPlayedHand) {
        return true; // Any valid combo is okay if starting a round
    }
    // Must be higher rank AND same or greater quantity
    return potentialPlay.rankValue > lastPlayedHand.rankValue &&
           potentialPlay.quantity >= lastPlayedHand.quantity;
}

// --- Helper functions for AI strategy ---
function getRemainingHand(currentHand, playToMake) {
    const playedCardIds = new Set(playToMake.cards.map(c => c.id));
    return currentHand.filter(card => !playedCardIds.has(card.id));
}
function countDistinctNonWildRanks(hand) {
    const ranks = new Set();
    hand.forEach(card => { if (!card.isWild) { ranks.add(card.rank); } });
    return ranks.size;
}
function getNonWildCardsByRank(hand) {
    return hand.filter(c => !c.isWild).reduce((acc, c) => {
        if (!acc[c.rank]) acc[c.rank] = [];
        acc[c.rank].push(c);
        return acc;
    }, {});
}
function findHighestNonWildCardId(hand) {
    let highestValue = -1; let highestId = null;
    hand.forEach(card => { if (!card.isWild && card.value > highestValue) { highestValue = card.value; highestId = card.id; } });
    return highestId;
}
function findLowestNonWildCardId(hand) {
    let lowestValue = Infinity; let lowestId = null;
    hand.forEach(card => { if (!card.isWild && card.value < lowestValue) { lowestValue = card.value; lowestId = card.id; } });
    return lowestId;
}
function findSecondLowestNonWildSinglePlay(hand, lastPlayedHand) {
    const nonWilds = hand.filter(c => !c.isWild);
    if (nonWilds.length < 2) { return null; }
    // Sort non-wilds low to high
    nonWilds.sort((a, b) => {
        const vA = a.value || 0; const vB = b.value || 0; if (vA !== vB) return vA - vB;
        const sO = { hearts: 1, diamonds: 2, clubs: 3, spades: 4, null: 5 }; return (sO[a.suit] || sO.null) - (sO[b.suit] || sO.null);
    });
    const secondLowestCard = nonWilds[1];
    const potentialPlay = { cards: [secondLowestCard], rankValue: secondLowestCard.value, quantity: 1, usesWilds: false };
    // Check if playing this single is valid against the last play
    if (isPlayValidVsLast(potentialPlay, lastPlayedHand)) { return potentialPlay; }
    else { return null; } // Cannot play the second lowest single
}
function filterAndSortLowestP5P6(candidates, rankLimit, royalLimit, avoidHighestId, lowestCardIdInHand, lastRankValue) {
    if (!candidates || candidates.length === 0) return [];
    // Plays containing the absolute lowest non-wild card
    const lowestCardPlays = candidates.filter(play => lowestCardIdInHand !== null && play.cards.some(c => c.id === lowestCardIdInHand));
    const lowestCardPlayIds = new Set(lowestCardPlays.map(p => p.cards.map(c => c.id).sort().join()));
    // Other plays, filtered by rules
    const filteredStandardPlays = candidates.filter(play => {
        const playId = play.cards.map(c => c.id).sort().join();
        if (lowestCardPlayIds.has(playId)) { return false; } // Avoid duplicates
        const rankCheck = lastRankValue === -1 || play.rankValue <= lastRankValue + rankLimit; // Within rank increment limit
        const highestCheck = avoidHighestId === null || !play.cards.some(c => c.id === avoidHighestId); // Doesn't use highest card
        const royalCheck = !(lastRankValue >= QUEEN_VALUE && play.rankValue > lastRankValue + royalLimit); // Avoids small increment on high royals
        return rankCheck && highestCheck && royalCheck;
    });
    const combinedCandidates = [...lowestCardPlays, ...filteredStandardPlays];
    if (combinedCandidates.length > 0) {
        // Sort: Lowest rank, fewest wilds, highest quantity (to shed cards)
        combinedCandidates.sort((a, b) => {
            if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
            const wildsA = a.cards.filter(c => c.isWild).length;
            const wildsB = b.cards.filter(c => c.isWild).length;
            if (wildsA !== wildsB) return wildsA - wildsB; // Prefer fewer wilds
            return b.quantity - a.quantity; // Prefer higher quantity
        });
        return combinedCandidates;
    }
    return [];
}


/**
 * AI chooses the best play from a list of valid plays based on game state and strategy.
 * @param {Array<object>} validPlays - Array of valid play objects.
 * @param {number} playerIndex - Index of the AI player.
 * @returns {object} { chosenPlay: object | null, playStyle: string, passReasonDetails?: object }
 */
function chooseBestPlay(validPlays, playerIndex) {
    if (!validPlays || validPlays.length === 0) {
        return { chosenPlay: null, playStyle: 'pass_no_valid', passReasonDetails: { message: "No valid plays found." } };
    }

    const aiPlayer = gameState.players[playerIndex];
    if (!aiPlayer || !aiPlayer.hand) {
        return { chosenPlay: null, playStyle: 'pass_internal_error', passReasonDetails: { message: "Internal AI error." } };
    }

    const aiHand = aiPlayer.hand;
    const lastPlayedHand = gameState.lastPlayedHand;
    const lastRankValue = lastPlayedHand?.rankValue ?? -1;
    const aiHandLength = aiHand.length;
    const mode = gameState.gameMode;
    let playStyle = 'default';
    let passReasonDetails = {};

    // --- Winning Play Check ---
    // Find plays that empty the hand and don't contain Aces or Wilds
    const winningPlays = validPlays.filter(play =>
        play.quantity === aiHandLength &&
        !play.cards.some(c => c.value === ACE_VALUE || c.isWild)
    );
    if (winningPlays.length > 0) {
        playStyle = 'winning';
        // If multiple winning plays (unlikely), sort? For now, take the first.
        sortHand(winningPlays[0].cards); // Sort cards within the play
        return { chosenPlay: winningPlays[0], playStyle: playStyle };
    }

    // --- Opponent Info Calculation ---
    let minOpponentHandSize = Infinity;
    let leadingPlayerHandSize = Infinity; // Smallest hand size among all players (including AI)
    let opponentCount = 0;
    let opponentAvgScores = [];

    gameState.players.forEach((player, index) => {
        const currentHandLength = player?.hand?.length ?? Infinity;
        leadingPlayerHandSize = Math.min(leadingPlayerHandSize, currentHandLength); // Update leader size

        if (index !== playerIndex && player) { // Only consider actual opponents
            opponentCount++;
            const oppHandLength = player.hand?.length ?? Infinity;
            minOpponentHandSize = Math.min(minOpponentHandSize, oppHandLength);
            opponentAvgScores.push(calculateAvgScore(player.hand));
        }
    });

    // --- Penultimate Hand Check ---
    // If AI has only 2 distinct non-wild ranks left, try to play the higher one if possible.
    const nonWildCardsByRank = getNonWildCardsByRank(aiHand);
    const distinctRankCount = Object.keys(nonWildCardsByRank).length;
    if (distinctRankCount === 2) {
        playStyle = 'penultimate';
        const ranks = Object.keys(nonWildCardsByRank);
        const rankValue1 = RANK_VALUES[ranks[0]];
        const rankValue2 = RANK_VALUES[ranks[1]];
        const higherRank = rankValue1 > rankValue2 ? ranks[0] : ranks[1];
        const lowerRank = rankValue1 < rankValue2 ? ranks[0] : ranks[1];
        const higherRankCards = nonWildCardsByRank[higherRank];
        const lowerRankCards = nonWildCardsByRank[lowerRank];
        const wildCards = aiHand.filter(c => c.isWild);

        // Try playing the higher rank + all wilds
        const playAttemptHigher = {
            cards: [...higherRankCards, ...wildCards],
            rankValue: RANK_VALUES[higherRank],
            quantity: higherRankCards.length + wildCards.length,
            usesWilds: wildCards.length > 0
        };
        if (isPlayValidVsLast(playAttemptHigher, lastPlayedHand)) {
            sortHand(playAttemptHigher.cards);
            return { chosenPlay: playAttemptHigher, playStyle: playStyle };
        }

        // If higher rank wasn't valid, try playing the lower rank + all wilds
        const playAttemptLower = {
            cards: [...lowerRankCards, ...wildCards],
            rankValue: RANK_VALUES[lowerRank],
            quantity: lowerRankCards.length + wildCards.length,
            usesWilds: wildCards.length > 0
        };
        if (isPlayValidVsLast(playAttemptLower, lastPlayedHand)) {
            sortHand(playAttemptLower.cards);
            return { chosenPlay: playAttemptLower, playStyle: `${playStyle}_lower_rank` };
        }
        // If neither is valid, fall through to other logic
    }

    // --- Stop Opponent Check ---
    // If any opponent has few cards left, play aggressively.
    if (minOpponentHandSize <= dynamicP2Threshold) {
        playStyle = 'stop_opponent';
        let P2Candidates = [...validPlays];
        // Sort aggressively: Highest rank, prefer no wilds, highest quantity
        P2Candidates.sort((a, b) => {
            let scoreA = a.rankValue - (a.usesWilds ? WILD_PENALTY : 0); // Penalize wilds slightly less here?
            let scoreB = b.rankValue - (b.usesWilds ? WILD_PENALTY : 0);
            if (scoreA !== scoreB) return scoreB - scoreA; // Highest effective rank
            if (a.quantity !== b.quantity) return b.quantity - a.quantity; // Highest quantity
            return b.rankValue - b.rankValue; // Tie-break pure rank
        });
        if (P2Candidates.length > 0) {
            sortHand(P2Candidates[0].cards);
            return { chosenPlay: P2Candidates[0], playStyle: playStyle };
        }
        // If no valid play found even in aggressive mode, prepare to pass
        passReasonDetails = { message: `Could not stop opponent (min hand ${minOpponentHandSize}).` };
        return { chosenPlay: null, playStyle: `pass_${playStyle}`, passReasonDetails };
    }

    // --- Falling Behind Check ---
    // Use different threshold based on game mode
    const fallingBehindThreshold = (mode === '1v1') ? FALLING_BEHIND_DIFF_1V1 : FALLING_BEHIND_DIFF_P4;
    if (lastPlayedHand && aiHandLength >= leadingPlayerHandSize + fallingBehindThreshold) {
        playStyle = 'falling_behind';
        let P4Candidates = [...validPlays];
        let chosenP4 = null;
        let p4Style = '';

        // Priority 1: Match quantity of last play (prefer lowest rank, fewest wilds)
        const matchingQuantityPlays = P4Candidates.filter(play => play.quantity === lastPlayedHand.quantity);
        if (matchingQuantityPlays.length > 0) {
            matchingQuantityPlays.sort((a, b) => {
                 if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; // Lowest rank
                 const wildsA = a.cards.filter(c => c.isWild).length;
                 const wildsB = b.cards.filter(c => c.isWild).length;
                 return wildsA - wildsB; // Fewest wilds
            });
            chosenP4 = matchingQuantityPlays[0];
            p4Style = 'falling_behind_match_qty';
        }

        // Priority 2: Increase quantity *without* using wilds (prefer lowest rank, highest quantity)
        if (!chosenP4) {
            const higherQuantityPlays = P4Candidates.filter(play => play.quantity > lastPlayedHand.quantity);
            const nonWildHigherQuantityPlays = higherQuantityPlays.filter(play => !play.usesWilds);
            if (nonWildHigherQuantityPlays.length > 0) {
                 nonWildHigherQuantityPlays.sort((a, b) => {
                     if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; // Lowest rank
                     return b.quantity - a.quantity; // Highest quantity (shed more cards)
                 });
                chosenP4 = nonWildHigherQuantityPlays[0];
                p4Style = 'falling_behind_increase_qty'; // Wilds not possible here
            }
        }

        // If a play was chosen based on falling behind priorities
        if (chosenP4) {
             p4Style += chosenP4.usesWilds ? '_with_wilds' : '_no_wilds'; // Append wild status
             sortHand(chosenP4.cards);
             return { chosenPlay: chosenP4, playStyle: p4Style };
        } else {
            // If no suitable play found under falling behind logic, prepare to pass
            passReasonDetails = { message: `Falling behind (hand ${aiHandLength} vs leader ${leadingPlayerHandSize}), no play matching/increasing qty.` };
            return { chosenPlay: null, playStyle: `pass_${playStyle}`, passReasonDetails };
        }
    }

    // --- Confident/Conservative Check ---
    const myAvgScore = calculateAvgScore(aiHand);
    const tableAvgScore = opponentCount > 0 ? opponentAvgScores.reduce((a, b) => a + b, 0) / opponentCount : 0;
    const highestCardId = findHighestNonWildCardId(aiHand);
    const lowestCardId = findLowestNonWildCardId(aiHand);
    const lowestCardRank = lowestCardId ? RANK_VALUES[aiHand.find(c => c && c.id === lowestCardId)?.rank] : null;

    // Track potential lowest play for reasoning/debugging
    let potentialLowestPlayInfo = null;
    let bestOverallValidPlay = null; // Needed for pass decision if no filter matches
    if (validPlays.length > 0) {
        const sortedByRank = [...validPlays].sort((a, b) => a.rankValue - b.rankValue);
        const lowestPlay = sortedByRank[0];
        potentialLowestPlayInfo = { rankValue: lowestPlay.rankValue, quantity: lowestPlay.quantity, usesWilds: lowestPlay.usesWilds, cards: lowestPlay.cards, isLowestRank: lowestPlay.rankValue === lowestCardRank, id: lowestPlay.cards.map(c => c.id).sort().join('-') };
        passReasonDetails.lowestPlayInfo = potentialLowestPlayInfo; // For Rule 3 check

        // Determine best overall if no specific strategy applies (lowest rank, fewest wilds, highest qty)
        bestOverallValidPlay = [...validPlays].sort((a, b) => {
            if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
            const wildsA = a.cards.filter(c => c.isWild).length;
            const wildsB = b.cards.filter(c => c.isWild).length;
            if (wildsA !== wildsB) return wildsA - wildsB;
            return b.quantity - a.quantity;
        })[0];
    }
    passReasonDetails.initialCandidate = bestOverallValidPlay; // Store this for Rule 5 check if passing


    // --- Confident State (Score is good) ---
    if (myAvgScore >= tableAvgScore) {
        playStyle = 'confident';
        let P5Choice = null;
        // Filter for "safer" plays: modest rank increase, avoid highest card, avoid small increments on high royals
        let filteredList = filterAndSortLowestP5P6(validPlays, 4, 2, highestCardId, lowestCardId, lastRankValue);
        if (filteredList && filteredList.length > 0) {
            P5Choice = filteredList[0]; // Best candidate from filtered list
            passReasonDetails.initialCandidate = P5Choice; // Update potential play for Rule 3/5 check
            playStyle = `${playStyle}${P5Choice.usesWilds ? '_with_wilds' : '_no_wilds'}`;

            // Check for Rule 3 potential (Ace Start Swap)
            const startingRound = !lastPlayedHand;
            const holdingAce = aiHand.some(c => c.rank === 'A');
            const lowestIsSingle = P5Choice.rankValue === lowestCardRank && P5Choice.quantity === 1;
            if (startingRound && holdingAce && lowestIsSingle) {
                 passReasonDetails.rule3_potential = true; // Signal for Rule 3 strategic check later
            }
            sortHand(P5Choice.cards);
            return { chosenPlay: P5Choice, playStyle: playStyle, passReasonDetails: passReasonDetails };
        } else {
            // No play found based on confident filter, return pass decision
            passReasonDetails.message = `Confident state pass (no suitable low-risk play).`;
            return { chosenPlay: null, playStyle: `pass_confident`, passReasonDetails };
        }
    }
    // --- Conservative State (Score is lower) ---
    else {
        playStyle = 'conservative';
        let P6Choice = null;

        // Check for Rank + 3 play (specific conservative tactic)
        let rankPlus3Play = null;
        if (lastRankValue !== -1) {
            const potentialRank = lastRankValue + 3;
            const rankPlus3Candidates = validPlays.filter(play =>
                play.rankValue === potentialRank &&
                !play.usesWilds && // Must not use wilds
                play.rankValue < ROYAL_VALUE_THRESHOLD // Must be below royals
            );
            if (rankPlus3Candidates.length > 0) {
                rankPlus3Candidates.sort((a, b) => b.quantity - a.quantity); // Prefer highest quantity
                rankPlus3Play = rankPlus3Candidates[0];
            }
        }

        // Filter for "safer" plays (more strict than confident): smaller rank increase, avoid highest, avoid small increments on high royals
        let filteredList = filterAndSortLowestP5P6(validPlays, 2, 1, highestCardId, lowestCardId, lastRankValue);
        let combinedP6Candidates = [];
        if (filteredList && filteredList.length > 0) {
            combinedP6Candidates.push(...filteredList);
        }
        // Add the rank+3 play if found and not already included
        if (rankPlus3Play) {
            const rankPlus3PlayId = rankPlus3Play.cards.map(c => c.id).sort().join();
            if (!combinedP6Candidates.some(p => p.cards.map(c => c.id).sort().join() === rankPlus3PlayId)) {
                combinedP6Candidates.push(rankPlus3Play);
            }
        }

        if (combinedP6Candidates.length > 0) {
            // Sort combined list: lowest rank, fewest wilds, highest quantity
            combinedP6Candidates.sort((a, b) => {
                if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
                const wildsA = a.cards.filter(c => c.isWild).length;
                const wildsB = b.cards.filter(c => c.isWild).length;
                if (wildsA !== wildsB) return wildsA - wildsB;
                return b.quantity - a.quantity;
            });
            P6Choice = combinedP6Candidates[0]; // Best conservative choice
            passReasonDetails.initialCandidate = P6Choice; // Update potential play for Rule 3/5 check
            playStyle = `${playStyle}${P6Choice.usesWilds ? '_with_wilds' : '_no_wilds'}`;

            // Override style if the chosen play was the specific rank+3 play
            if (P6Choice === rankPlus3Play) {
                playStyle = 'conservative_rank_plus_3';
            }

            // Check for Rule 3 potential (Ace Start Swap)
            const startingRound = !lastPlayedHand;
            const holdingAce = aiHand.some(c => c.rank === 'A');
            const isLowestRankPlay = P6Choice.rankValue === lowestCardRank;
            const isSinglePlay = P6Choice.quantity === 1;
             if (startingRound && holdingAce && isLowestRankPlay && isSinglePlay) {
                passReasonDetails.rule3_potential = true; // Signal for Rule 3 strategic check later
             }
            sortHand(P6Choice.cards);
            return { chosenPlay: P6Choice, playStyle: playStyle, passReasonDetails: passReasonDetails };
        } else {
            // No play found based on conservative filters, return pass decision
            passReasonDetails.message = `Conservative state pass (no suitable low-risk play).`;
            return { chosenPlay: null, playStyle: `pass_conservative`, passReasonDetails };
        }
    }
}


/**
 * Handles the AI player's turn, including choosing and executing a play or pass.
 * @param {number} playerIndex - Index of the AI player taking the turn.
 */
function handleAITurn(playerIndex) {
    const aiPlayer = gameState.players[playerIndex];
    if (!aiPlayer || !aiPlayer.hand) { console.error(`handleAITurn: Invalid playerIndex ${playerIndex} or missing hand.`); return; }

    const playerName = aiPlayer.name;
    const playerHand = aiPlayer.hand;
    console.log(`--- AI Turn Start: ${playerName} (Index: ${playerIndex}, Mode: ${gameState.gameMode}) ---`);
    console.log(`Current hand (${playerHand.length}): ${playerHand.map(c => c.display).join(', ')}`);
    console.log(`Last Play: ${gameState.lastPlayedHand ? `${gameState.lastPlayedHand.quantity}x ${getRankName(gameState.lastPlayedHand.rankValue)}` : 'None'}`);
    console.log(`Current passedPlayers: [${gameState.passedPlayers.join(', ')}]`);

    // Update UI to show "Thinking..."
    aiPlayer.lastReasoning = "Thinking...";
    renderHands(); // Update reasoning display

    // Delay reasoning and action to simulate thought
    setTimeout(() => {
        gameState.turnCount++;
        let actionReason = "";
        let chosenPlay = null; // Final decision play
        let playStyle = 'default'; // Final decision style
        let executePass = false; // Final decision pass flag

        // Find all technically valid plays
        const validPlays = findValidPlays(playerHand, gameState.lastPlayedHand);
        // Get opponent info for reasoning text generation
        let minOpponentHandSizeForReasoning = Infinity;
        gameState.players.forEach((p, idx) => { if(idx !== playerIndex && p && p.hand) { minOpponentHandSizeForReasoning = Math.min(minOpponentHandSizeForReasoning, p.hand.length); } });

        const isStartingRound = !gameState.lastPlayedHand;
        const totalWildsInHand = playerHand.filter(c => c.isWild).length; // Needed for ratio checks

        // --- Initial Decision Making ---
        let initialDecision = {};
        // Special case: First play of the game (must play 4♥)
        if (!gameState.isGameStarted && playerHand.some(card => card.rank === '4' && card.suit === 'hearts')) {
            // Valid plays should already be filtered for 4h by findValidPlays
            if (validPlays.length > 0) {
                // Use chooseBestPlay to apply sorting/preference if multiple 4h plays exist
                initialDecision = chooseBestPlay(validPlays, playerIndex);
                chosenPlay = initialDecision.chosenPlay || validPlays[0]; // Fallback to first valid 4h play
                playStyle = 'start_4h';
                // gameState.isGameStarted = true; // Mark game started *after* choosing play // Moved to after play execution
                executePass = false;
            } else {
                // This should not happen if findValidPlays works correctly, but handle defensively
                console.error(`AI (${playerName}) has 4♥ but no valid starting play found!`);
                executePass = true;
                playStyle = 'pass_no_4h_play_chosen';
            }
        } else {
            // Normal turn: Use chooseBestPlay to get initial recommendation
            initialDecision = chooseBestPlay(validPlays, playerIndex);
            chosenPlay = initialDecision.chosenPlay;
            playStyle = initialDecision.playStyle;
            executePass = !chosenPlay; // Initial pass flag based on chooseBestPlay result
            console.log(`AI (${playerName}) initial decision: Style=${playStyle}, Play=${chosenPlay ? chosenPlay.cards.map(c=>c.display).join(',') : 'None'}, ExecutePass=${executePass}`);
        }


        // --- Strategic Override Logic ---
        // Only consider overriding baseline confident/conservative plays or passes derived from them
        if (playStyle.startsWith('confident') || playStyle.startsWith('conservative') || playStyle.startsWith('pass_confident') || playStyle.startsWith('pass_conservative')) {
            console.log(`AI (${playerName}) evaluating strategic rules for ${playStyle} mode.`);
            let strategicOverrideOccurred = false;
            let overrideChosen = false; // Flag to prevent multiple overrides applying
            const passDetails = initialDecision.passReasonDetails || {};
            // If initial decision was pass, playToCheckForRule5 is the best play it *could* have made.
            // If initial decision was play, playToCheckForRule5 is that play.
            const playToCheckForRule5 = chosenPlay || passDetails.initialCandidate;

            // --- Rule 5 Check (High Wildcard Usage Pass) ---
            // If considering a play that uses a high % of available wilds, force a pass instead.
            if (playToCheckForRule5 && playToCheckForRule5.usesWilds && playerHand.length >= MIN_CARDS_FOR_WILD_PASS_RULE) {
                const wildsUsedInCheck = playToCheckForRule5.cards.filter(c => c.isWild).length;
                if (totalWildsInHand > 0) { // Avoid division by zero
                    const wildcardUsageRatio = wildsUsedInCheck / totalWildsInHand;
                     if (wildcardUsageRatio > dynamicWildcardPassThreshold) {
                         console.log(`AI (${playerName}) Strategic Rule 5: Play [${playToCheckForRule5.cards.map(c=>c.display).join(',')}] uses too many wilds (${(wildcardUsageRatio*100).toFixed(0)}% > ${(dynamicWildcardPassThreshold*100).toFixed(0)}%). Forcing PASS.`);
                         chosenPlay = null; executePass = true; playStyle = 'pass_strategic_high_wild_usage'; strategicOverrideOccurred = true; overrideChosen = true;
                     }
                }
            }

            // --- Check Other Rules (Only if Rule 5 didn't force pass/override) ---
            if (!overrideChosen) {
                // Find candidates needed for multiple rules
                let potentialRule4Play = null; // Rule 4 (Refinement Only): Low non-wild play below threshold
                if (!isStartingRound) { // Rule 4 doesn't apply when starting
                    const lowNonWildPlays = validPlays.filter(play => !play.usesWilds && play.rankValue < dynamicRule4RankThreshold);
                    if (lowNonWildPlays.length > 0) {
                        lowNonWildPlays.sort((a, b) => a.rankValue - b.rankValue || b.quantity - a.quantity); // Lowest rank, highest qty
                        potentialRule4Play = lowNonWildPlays[0];
                    }
                }

                let potentialRule1Play = null; // Rule 1 (Pass Override): Single Ace play
                let potentialRule1AceWildPlay = null; // Rule 1 (Pass Override): Ace + Wilds play
                const aceCount = playerHand.filter(c => c.rank === 'A').length;
                // Rule 1 only applies if not starting round and holding multiple Aces (to justify playing one)
                if (!isStartingRound && aceCount >= 2) {
                    // Check for single Ace play
                    potentialRule1Play = validPlays.find(p => p.quantity === 1 && p.rankValue === ACE_VALUE);

                    // Check for Ace + Wilds play (if needed quantity > 1)
                    const requiredQtyForRule1 = gameState.lastPlayedHand?.quantity ?? 1;
                    if (requiredQtyForRule1 > 1) {
                         const acePlusWildCandidates = validPlays.filter(play =>
                             play.quantity === requiredQtyForRule1 &&
                             play.cards.some(c => c.rank === 'A') && // Contains an Ace
                             play.cards.filter(c => c.rank === 'A').length === 1 && // Exactly one Ace
                             play.usesWilds // Must use wilds
                         );
                         if (acePlusWildCandidates.length > 0) {
                             // Filter by wildcard ratio threshold (don't use too many wilds even for Ace)
                             const validRatioPlays = acePlusWildCandidates.filter(play => {
                                 const wildsUsed = play.cards.filter(c => c.isWild).length;
                                 return totalWildsInHand === 0 ? false : (wildsUsed / totalWildsInHand) <= dynamicWildcardPassThreshold;
                             });
                             if (validRatioPlays.length > 0) {
                                 // Sort by fewest wildcards used
                                 validRatioPlays.sort((a, b) => a.cards.filter(c => c.isWild).length - b.cards.filter(c => c.isWild).length);
                                 potentialRule1AceWildPlay = validRatioPlays[0];
                             }
                         }
                    }
                }

                let potentialRule3Play = null; // Rule 3 (Ace Start Swap): Play 2nd lowest single instead of lowest
                const hasAce = playerHand.some(c => c.rank === 'A');
                // Check if initial decision was the lowest single (using flag set in chooseBestPlay)
                const initialChoiceWasLowestSingle = passDetails.rule3_potential === true;
                if (isStartingRound && hasAce && initialChoiceWasLowestSingle) {
                    potentialRule3Play = findSecondLowestNonWildSinglePlay(playerHand, gameState.lastPlayedHand);
                }


                // --- Apply Rule 3 first if applicable (Ace/Lowest Start Swap) ---
                if (potentialRule3Play) {
                     console.log(`AI (${playerName}) Strategic Rule 3: Applying Ace/Lowest Start rule. Playing 2nd lowest single.`);
                     chosenPlay = potentialRule3Play; playStyle = 'strategic_override_second_low'; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                     sortHand(chosenPlay.cards); // Sort cards within the play
                }

                // --- Check Other Rules (Only if Rule 3 didn't apply) ---
                if (!overrideChosen) {
                    const initialDecisionWasPass = !initialDecision.chosenPlay; // Check if the *initial* choice was pass

                    if (initialDecisionWasPass) {
                        // --- Attempt to Override an Initial PASS ---
                        console.log(`AI (${playerName}) Initial decision was PASS. Checking Rules 6, 1, 2...`);

                        // *** Rule 6 Check (Override Pass with Low Non-Wild) ***
                        let potentialRule6Play = null;
                        let rule6Style = '';
                        // Condition A: Can play lowest non-wild rank (possibly with wilds)?
                        const lowestCardNonWildId = findLowestNonWildCardId(playerHand);
                        if (lowestCardNonWildId) {
                            const lowestRankValue = playerHand.find(c => c.id === lowestCardNonWildId)?.value;
                            if (lowestRankValue) {
                                const requiredQtyRule6 = gameState.lastPlayedHand?.quantity ?? 1; // Need at least 1 if starting
                                // Find valid plays using the lowest rank, matching/exceeding quantity
                                const lowestRankPlays = validPlays.filter(play =>
                                    play.rankValue === lowestRankValue &&
                                    play.quantity >= requiredQtyRule6 // Allow exceeding quantity here too? Let's stick to matching for now.
                                    // play.quantity === requiredQtyRule6 // Stricter: must match quantity
                                );

                                if (lowestRankPlays.length > 0) {
                                    // Sort by fewest wilds first, then highest quantity (if allowing exceeding)
                                    lowestRankPlays.sort((a,b) => {
                                        const wildsA = a.cards.filter(c=>c.isWild).length;
                                        const wildsB = b.cards.filter(c=>c.isWild).length;
                                        if (wildsA !== wildsB) return wildsA - wildsB;
                                        return b.quantity - a.quantity; // Prefer higher quantity if wilds are equal
                                    });
                                    // Check the best option (fewest wilds, potentially highest qty)
                                    const candidatePlay = lowestRankPlays[0];
                                    if (candidatePlay.usesWilds) {
                                        // Check wildcard ratio if wilds are needed
                                        const wildsUsed = candidatePlay.cards.filter(c => c.isWild).length;
                                        if (totalWildsInHand > 0 && (wildsUsed / totalWildsInHand) <= dynamicWildcardPassThreshold) {
                                            potentialRule6Play = candidatePlay;
                                            rule6Style = 'strategic_override_lowest_nw_wild';
                                        } else {
                                            console.log(`AI (${playerName}) Rule 6 Cond A: Lowest rank play [${candidatePlay.cards.map(c=>c.display).join(',')}] needs wilds, but ratio too high.`);
                                        }
                                    } else {
                                        // No wilds needed, it's valid
                                        potentialRule6Play = candidatePlay;
                                        rule6Style = 'strategic_override_lowest_nw';
                                    }
                                }
                            }
                        }

                        // Condition B: Can play any non-wild below Jack (fallback)?
                        if (!potentialRule6Play && gameState.lastPlayedHand) { // Only check if A failed and not start of round
                            let belowJackPlays = validPlays.filter(play => !play.usesWilds && play.rankValue < JACK_VALUE);
                            if (belowJackPlays.length > 0) {
                                // Sort: Prefer matching quantity, then lowest rank, then highest quantity
                                belowJackPlays.sort((a, b) => {
                                    const qtyMatchA = a.quantity === gameState.lastPlayedHand.quantity;
                                    const qtyMatchB = b.quantity === gameState.lastPlayedHand.quantity;
                                    if(qtyMatchA !== qtyMatchB) return qtyMatchB ? 1 : -1; // Prioritize matching qty
                                    if(a.rankValue !== b.rankValue) return a.rankValue - b.rankValue; // Then lowest rank
                                    return b.quantity - a.quantity; // Then highest quantity
                                });
                                potentialRule6Play = belowJackPlays[0];
                                rule6Style = 'strategic_override_below_jack_nw';
                            }
                        }

                        // Apply Rule 6 if either condition found a play
                        if (potentialRule6Play) {
                             console.log(`AI (${playerName}) Strategic Rule 6 (${rule6Style}): Overriding initial PASS.`);
                             chosenPlay = potentialRule6Play; playStyle = rule6Style; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                             sortHand(chosenPlay.cards);
                        }
                        // *** End Rule 6 Check ***


                        // *** Rule 1 Check (Override Pass with Ace) ***
                        // Check Rule 1 Pass Override (Only if Rule 6 didn't apply)
                        if (!overrideChosen) { // Already includes !isStartingRound check in candidate generation
                            if (potentialRule1AceWildPlay) { // Check Ace+Wild first
                                console.log(`AI (${playerName}) Strategic Rule 1: Overriding initial PASS with Ace + Wilds.`);
                                chosenPlay = potentialRule1AceWildPlay; playStyle = 'strategic_override_ace_wild'; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                                sortHand(chosenPlay.cards);
                            } else if (potentialRule1Play) { // Fallback to single Ace
                                console.log(`AI (${playerName}) Strategic Rule 1: Overriding initial PASS with single Ace.`);
                                chosenPlay = potentialRule1Play; playStyle = 'strategic_override_ace'; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                                sortHand(chosenPlay.cards);
                            }
                        }
                        // *** End Rule 1 Check ***


                        // *** Rule 2 Check (Override Pass with Low + Wild) ***
                        // Only if 6 & 1 didn't apply, holding >= 3 wilds, last play was low rank, and initial pass was on a double play.
                        const wildCount = totalWildsInHand;
                        const initialPassWasOnDouble = passDetails.initialCandidate?.quantity === 2; // Check if the play it *would* have made was a double
                        const lastRankVal = gameState.lastPlayedHand?.rankValue ?? -1;
                        if (!overrideChosen && wildCount >= 3 && lastRankVal < JACK_VALUE && initialPassWasOnDouble) {
                            const nonWildsSorted = playerHand.filter(c => !c.isWild).sort((a, b) => a.value - b.value);
                            const lowestNonWildCard = nonWildsSorted.length > 0 ? nonWildsSorted[0] : null;
                            const availableWild = playerHand.find(c => c.isWild); // Just need one wild
                            if (lowestNonWildCard && availableWild) {
                                 // Construct the potential play: lowest non-wild + one wild
                                 const lowestPlusWildPlay = { cards: [lowestNonWildCard, availableWild], rankValue: lowestNonWildCard.value, quantity: 2, usesWilds: true, id: [lowestNonWildCard.id, availableWild.id].sort().join('-') };
                                 // Check if this constructed play is actually valid (it might not be if last play was also rank 2)
                                 if (isPlayValidVsLast(lowestPlusWildPlay, gameState.lastPlayedHand)) {
                                    console.log(`AI (${playerName}) Strategic Rule 2: Overriding initial PASS with low non-wild + wild.`);
                                    sortHand(lowestPlusWildPlay.cards);
                                    chosenPlay = lowestPlusWildPlay; playStyle = 'strategic_override_low_wild'; executePass = false; strategicOverrideOccurred = true; overrideChosen = true;
                                 }
                            }
                        }
                        // *** End Rule 2 Check ***

                    } else {
                        // --- Initial decision was PLAY - Check Rule 4 Refinement ---
                        // If a better, low non-wild play exists, prefer it over the initial choice (especially if initial used wilds).
                         if (potentialRule4Play && chosenPlay) {
                             // Refine if current play uses wilds OR the Rule 4 play is lower rank
                             if (chosenPlay.usesWilds || potentialRule4Play.rankValue < chosenPlay.rankValue) {
                                console.log(`AI (${playerName}) Strategic Rule 4: Refining play. Preferring low non-wild [${potentialRule4Play.cards.map(c=>c.display).join(',')}] over [${chosenPlay.cards.map(c=>c.display).join(',')}].`);
                                chosenPlay = potentialRule4Play; playStyle = 'strategic_override_low_no_wild'; strategicOverrideOccurred = true; overrideChosen = true;
                                sortHand(chosenPlay.cards);
                             }
                        }
                    }
                } // End check if Rule 3 applied
            } // End check if Rule 5 applied
        } // End check for Confident/Conservative/Pass style for overrides
        // --- End Strategic Override Logic ---


        // --- Final Win Condition Check ---
        // If the chosen play (initial or overridden) would empty the hand, double-check it's valid (no Ace/Wild)
        if (!executePass && chosenPlay && playerHand.length === chosenPlay.quantity) {
            if (chosenPlay.cards.some(card => card.value === ACE_VALUE || card.isWild)) {
                console.log(`AI (${playerName}) final play [${chosenPlay.cards.map(c=>c.display).join(', ')}] is invalid win (Ace/Wild). Forcing pass.`);
                chosenPlay = null; executePass = true; playStyle = 'pass_invalid_win_forced_pass'; strategicOverrideOccurred = true; // Mark as override leading to pass
            }
        }

        // --- Generate Final Reasoning Text ---
        actionReason = generateReasoningText(playStyle, chosenPlay, minOpponentHandSizeForReasoning);
        aiPlayer.lastReasoning = actionReason;
        console.log(`AI (${playerName}) final action: ${executePass ? 'PASS' : 'PLAY ' + (chosenPlay ? chosenPlay.cards.map(c=>c.display).join(',') : 'ERROR')}. Style: ${playStyle}. Reason: ${actionReason}`);

        // --- Execute Final Action (Play or Pass) ---
        if (!executePass && chosenPlay) {
            // Execute Play
            sortHand(chosenPlay.cards); // Ensure cards in the chosen play are sorted before logging/rendering
            logDetailedTurn('play', { cards: chosenPlay.cards.map(c => c.display).join(';'), rank: chosenPlay.rankValue, qty: chosenPlay.quantity, wilds: chosenPlay.usesWilds, style: playStyle });

            // Mark game started if this is the first play (4h)
            if (!gameState.isGameStarted && chosenPlay.cards.some(c => c.rank === '4' && c.suit === 'hearts')) {
                gameState.isGameStarted = true;
                console.log("Game marked as started after AI played 4H.");
            }

            // Update Game State
            gameState.lastPlayedHand = { ...chosenPlay, playerIndex: playerIndex }; // Store who played it
            trackPlayedCards(chosenPlay);
            const playedCardIds = new Set(chosenPlay.cards.map(card => card.id));
            gameState.players[playerIndex].hand = playerHand.filter(card => !playedCardIds.has(card.id)); // Remove cards

            // Update UI
            logPlay(playerIndex, chosenPlay);
            renderPlayArea(gameState.lastPlayedHand);
            renderHands(); // Update AI hand display (card backs) and counts

            // Check for Win
            if (gameState.players[playerIndex]?.hand?.length === 0) {
                declareWinner(playerIndex);
                return; // Game Over
            }

            // Check for Ace Rule (Round Win)
            if (chosenPlay.rankValue === ACE_VALUE) {
                logEvent(`Aces played by ${playerName} - Round Over!`, "round-end");
                logDetailedTurn('round_end', { reason: 'ace', winner: playerIndex });
                updateStatus(`${playerName} played Aces...`);
                // Start next round after delay, this AI player starts
                setTimeout(() => { startNextRound(playerIndex); }, ROUND_END_DELAY);
                return; // End turn early
            }

            // Advance turn normally
            advanceTurn();

        } else {
             // Execute Pass
             logDetailedTurn('pass', { reason: playStyle.startsWith('pass_') ? playStyle.substring(5) : playStyle }); // Log reason for pass
             if (!gameState.passedPlayers.includes(playerIndex)) {
                 gameState.passedPlayers.push(playerIndex);
                 logEvent(`${playerName} passed.`, 'pass');
             }
             renderHands(); // Update display to show pass status (dimmed, etc.)
             updateStatus(`${playerName} passed. Advancing turn...`);

             // Check if round is over after AI pass
            if (checkRoundOver()) {
                const roundWinnerIndex = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1;
                if (roundWinnerIndex !== -1 && gameState.players[roundWinnerIndex]) {
                    const winnerName = gameState.players[roundWinnerIndex].name;
                    logEvent(`${winnerName} wins the round (opponents passed).`, 'round-end');
                    logDetailedTurn('round_end', { reason: 'pass', winner: roundWinnerIndex });
                    updateStatus(`Round over! ${winnerName} wins...`);
                    // Start next round after delay, winner starts
                    setTimeout(() => { startNextRound(roundWinnerIndex); }, STANDARD_ROUND_END_DELAY);
                } else {
                    console.error(`Round over after AI pass, but couldn't determine winner! Last play owner: ${roundWinnerIndex}`);
                    advanceTurn(); // Proceed if error?
                }
            } else {
                // Round not over, just advance turn
                advanceTurn();
            }
        }

    }, AI_REASONING_DELAY); // Delay AI reasoning/action
}


// --- Round and Turn Management ---

/**
 * Checks if the current round is over (all players except one have passed).
 * @returns {boolean} True if the round is over, false otherwise.
 */
function checkRoundOver() {
    if (!gameState || !gameState.players || gameState.players.length === 0) return false;
    const activePlayers = gameState.players.length;
    const neededToPass = activePlayers - 1; // All players except one must pass
    const result = gameState.passedPlayers.length >= neededToPass;
    // console.log(`checkRoundOver: Passed=${gameState.passedPlayers.length}, Needed=${neededToPass}, Result=${result}`);
    return result;
}

/**
 * Starts the next round, clearing passed players and setting the winner as the current player.
 * @param {number} winnerIndex - The index of the player who won the last round.
 */
function startNextRound(winnerIndex) {
    console.log(`>>> startNextRound called for winner: Player ${winnerIndex} <<<`);
    if (gameState.isGameOver) return; // Don't start new round if game ended

    if (winnerIndex < 0 || winnerIndex >= gameState.players.length || !gameState.players[winnerIndex]) {
        console.error(`startNextRound: Invalid winnerIndex ${winnerIndex}`);
        // Attempt recovery? Maybe default to player 0? Or just stop?
        // For now, log error and potentially let the game stall.
        updateStatus("Error starting next round: Invalid winner.");
        return;
    }

    const winnerName = gameState.players[winnerIndex].name;
    console.log(`Starting next round. Winner: ${winnerName}`);

    // Reset round state
    gameState.passedPlayers = [];
    gameState.players.forEach(p => { if(p && p.id !== 1) p.lastReasoning = ""; }); // Clear AI reasoning
    gameState.lastPlayedHand = null; // Clear the play area visually

    // Clear visual play area and log for the current mode
    const mode = gameState.gameMode;
    renderPlayArea(null); // Clear played cards visually
    const logArea = document.getElementById(`play-log${mode === '1v1' ? '-1v1' : '-3p'}`);
    if (logArea) logArea.innerHTML = ''; // Clear the log display

    // Set current player
    gameState.currentPlayerIndex = winnerIndex;

    // Update UI
    renderHands(); // Update player styles (remove passed status, highlight current)
    updateStatus(`Round won by ${winnerName}. Starting next round. It's ${winnerName}'s turn.`);

    // If the winner is an AI, trigger their turn after a delay
    if (winnerIndex > 0) { // AI players have index > 0
        // Ensure the AI player object exists before accessing properties
        if (gameState.players[winnerIndex]) {
            gameState.players[winnerIndex].lastReasoning = "Thinking..."; // Show thinking immediately
            renderHands(); // Update reasoning display
        }
        console.log(`Scheduling AI turn for ${winnerName} (starting new round) in ${ROUND_END_DELAY}ms`);
        setTimeout(() => {
            // Check if the game state is still valid before triggering AI
            if (!gameState.isGameOver && gameState.currentPlayerIndex === winnerIndex) {
                 handleAITurn(winnerIndex);
            } else {
                console.log(`Timeout skipped for startNextRound winner ${winnerName} (state changed: GameOver=${gameState.isGameOver}, CurrentPlayer=${gameState.currentPlayerIndex})`);
            }
        }, ROUND_END_DELAY); // Use a longer delay after round end
    }
}

/**
 * Advances the turn to the next active (not passed) player.
 */
function advanceTurn() {
    if (gameState.isGameOver) {
        console.log("advanceTurn: Game is over, turn not advanced.");
        return;
    }

    let nextPlayerIndex = gameState.currentPlayerIndex;
    let loopGuard = 0; // Prevent infinite loops
    const numPlayers = gameState.players.length;
    const initialIndex = gameState.currentPlayerIndex;

    do {
        nextPlayerIndex = (nextPlayerIndex + 1) % numPlayers;
        loopGuard++;

        // Safety break for potential infinite loops
        if (loopGuard > numPlayers * 2) {
            console.error("Infinite loop detected in advanceTurn! Breaking.");
            updateStatus("Error: Turn advancement loop detected.");
            // Potentially try to force a round end?
             if(checkRoundOver()){
                 const rWI = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1;
                 if(rWI !== -1 && rWI < numPlayers && gameState.players[rWI]) {
                     console.warn("Forcing round end due to loop detection.");
                     startNextRound(rWI);
                 } else {
                     console.error(`Loop detected, round over, but winner index ${rWI} invalid.`);
                 }
             } else {
                 console.error("Loop detected, but round not over?");
             }
            return;
        }

        // Check if we've looped back to the start without finding an active player
        // This implies the round should be over (everyone else passed)
        if (nextPlayerIndex === initialIndex && loopGuard > numPlayers) {
             console.warn("advanceTurn looped back to start. Checking round over state.");
             if(checkRoundOver()){
                 const roundWinnerIndex = gameState.lastPlayedHand ? gameState.lastPlayedHand.playerIndex : -1;
                 if(roundWinnerIndex !== -1 && roundWinnerIndex < numPlayers && gameState.players[roundWinnerIndex]) {
                     console.log("Round ended because all other players passed.");
                     startNextRound(roundWinnerIndex);
                 } else {
                     console.error(`Round over state detected in advanceTurn loop, but winner index ${roundWinnerIndex} is invalid.`);
                     updateStatus("Error: Could not determine round winner.");
                 }
             } else {
                 // This state should ideally not be reachable if checkRoundOver is accurate
                 console.error("advanceTurn loop detected, but checkRoundOver is false? State potentially inconsistent.");
                 updateStatus("Error: Turn advancement failed.");
             }
             return; // Exit advanceTurn as round is over or errored
        }

    } while (gameState.passedPlayers.includes(nextPlayerIndex)); // Keep looping if the next player has passed

    // Found the next active player
    gameState.currentPlayerIndex = nextPlayerIndex;

    if (nextPlayerIndex < 0 || nextPlayerIndex >= numPlayers || !gameState.players[gameState.currentPlayerIndex]) {
        console.error(`advanceTurn: Determined invalid nextPlayerIndex ${nextPlayerIndex}`);
        updateStatus("Error: Invalid next player.");
        return; // Stop if index is invalid
    }

    const nextPlayer = gameState.players[gameState.currentPlayerIndex];
    updateStatus(`It's ${nextPlayer.name}'s turn.`);
    renderHands(); // Update player highlights

    // If the next player is AI, trigger their turn after a standard delay
    if (gameState.currentPlayerIndex > 0) { // AI players have index > 0
        setTimeout(() => {
            // Double-check state before triggering AI turn
            const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id; // Get ID
            if (currentPlayerId && // Check player exists and has ID
                gameState.currentPlayerIndex === (currentPlayerId - 1) && // Ensure player index matches ID-1
                !gameState.isGameOver &&
                !gameState.passedPlayers.includes(gameState.currentPlayerIndex)) // Ensure player hasn't passed somehow
            {
                handleAITurn(gameState.currentPlayerIndex);
            } else {
                 console.log(`AI turn for P${gameState.currentPlayerIndex+1} skipped (state changed: GameOver=${gameState.isGameOver}, CurrentPlayer=${gameState.currentPlayerIndex}, Passed=${gameState.passedPlayers.includes(gameState.currentPlayerIndex)}, ID Mismatch?)`);
            }
        }, AI_TURN_DELAY);
    }
}


// --- Game Initialization ---

/**
 * Initializes a new game based on the selected mode.
 * @param {string} mode - '3player' or '1v1'.
 */
function initializeGame(mode) {
    console.log(`Initializing Swedish Kings (${mode} mode)...`);
    updateStatus("Setting up game...");

    // Increment games played count when a new game starts
    totalGamesPlayed++;
    updateStatsDisplay(); // Update stats display immediately

    gameState.gameMode = mode; // Set the game mode

    // --- Set Dynamic AI Parameters ---
    // These could potentially be mode-specific if desired
    dynamicP2Threshold = Math.random() < 0.5 ? 3 : 4; // Threshold for "Stop Opponent"
    dynamicWildcardPassThreshold = Math.random() < 0.5 ? 0.40 : 0.50; // Wild usage % for Rule 5 pass
    dynamicRule4RankThreshold = Math.floor(Math.random() * 5) + 6; // Max rank for Rule 4 refinement (6-10)
    console.log(`Game Settings: P2 <= ${dynamicP2Threshold}, Wild Pass > ${dynamicWildcardPassThreshold * 100}%, Rule 4 Rank < ${dynamicRule4RankThreshold}`);

    // --- Game Log Counter ---
    gameCounter++;
    currentGameDetailedLog = [];
    logDetailedTurn('game_start', {
        mode: mode, // Log the mode
        p2Threshold: dynamicP2Threshold,
        wildPassThreshold: dynamicWildcardPassThreshold,
        rule4RankThreshold: dynamicRule4RankThreshold
    });

    // --- Setup Players based on mode ---
    gameState.players = [];
    gameState.players.push({ id: 1, name: "You", hand: [] }); // Human player is always index 0, id 1

    let availableNames = [...COMPUTER_NAMES];
    if (mode === '3player') {
        let nameIndex1 = Math.floor(Math.random() * availableNames.length);
        const name1 = availableNames[nameIndex1];
        availableNames.splice(nameIndex1, 1); // Remove used name
        gameState.players.push({ id: 2, name: name1, hand: [], lastReasoning: "" });

        let nameIndex2 = Math.floor(Math.random() * availableNames.length);
        const name2 = availableNames[nameIndex2];
        gameState.players.push({ id: 3, name: name2, hand: [], lastReasoning: "" });
        console.log(`Assigned names (3p): P1=${name1}, P2=${name2}`);
    } else { // 1v1 mode
        let nameIndex1 = Math.floor(Math.random() * availableNames.length);
        const name1 = availableNames[nameIndex1];
        gameState.players.push({ id: 2, name: name1, hand: [], lastReasoning: "" }); // Only one computer opponent
        console.log(`Assigned name (1v1): P1=${name1}`);
    }

    // --- Reset Game State Variables ---
    gameState.deck = createDeck();
    // Don't shuffle yet for 1v1, deal function handles it after removing 4h
    gameState.players.forEach(p => { if(p) { p.hand = []; if (p.id !== 1) p.lastReasoning = ""; }}); // Clear hands/reasoning
    selectedCards = [];
    gameState.lastPlayedHand = null;
    gameState.passedPlayers = [];
    gameState.isGameOver = false;
    gameState.winner = null;
    gameState.isGameStarted = false;
    gameState.turnCount = 0;
    gameState.playedCards = {};
    gameState.unusedCards = []; // Clear unused cards

    // --- Deal Cards based on mode ---
    if (mode === '3player') {
        shuffleDeck(gameState.deck); // Shuffle before dealing in 3p
        dealCards3Player(gameState.deck, gameState.players);
    } else { // 1v1 mode
        dealCards1v1(gameState.deck, gameState.players); // Deals 18 each, ensures 4h
    }
    console.log("Cards dealt.");

    // --- Reset UI Elements ---
    const playerSuffix = mode === '1v1' ? '-1v1' : '-3p';
    // Clear win/pass/current highlights from all player areas in this mode
    gameState.players.forEach((p, index) => {
        let playerAreaId;
         if (index === 0) {
             playerAreaId = `human-player${playerSuffix}`;
         } else {
             // Determine the correct computer area ID based on mode and index
             playerAreaId = (mode === '1v1' || index === 1) ? `computer-1${playerSuffix}` : `computer-2${playerSuffix}`;
         }
         const el = document.getElementById(playerAreaId);
         if (el) {
             el.classList.remove('player-wins', 'player-passed', 'current-player');
         } else {
             // This might happen if switching modes quickly, log if needed
             // console.warn(`Init Reset: Player area element not found for ID: ${playerAreaId}`);
         }
    });

    // Clear play area and log
    renderPlayArea(null);
    const logArea = document.getElementById(`play-log${playerSuffix}`);
    if (logArea) logArea.innerHTML = '';
    // Enable buttons
    const playButton = document.getElementById(`play-button${playerSuffix}`);
    const passButton = document.getElementById(`pass-button${playerSuffix}`);
    const clearButton = document.getElementById(`clear-selection-button${playerSuffix}`);
    if (playButton) playButton.disabled = false;
    if (passButton) passButton.disabled = false;
    if (clearButton) clearButton.disabled = false;


    // --- Determine Starting Player (who has 4♥) ---
    let startingPlayerFound = false;
    gameState.currentPlayerIndex = -1;
    for (let i = 0; i < gameState.players.length; i++) {
        if (gameState.players[i]?.hand?.some(c => c.rank === '4' && c.suit === 'hearts')) {
            gameState.currentPlayerIndex = i;
            startingPlayerFound = true;
            break;
        }
    }

    // Safety check if 4♥ wasn't found (shouldn't happen with deal logic)
    if (!startingPlayerFound || gameState.currentPlayerIndex === -1) {
        console.error(`CRITICAL ERROR: 4 of Hearts not found after dealing in ${mode} mode! Defaulting to Player 0.`);
        gameState.currentPlayerIndex = 0;
        if (!gameState.players[0]) {
            console.error("CRITICAL ERROR: Player 0 missing after default start.");
            updateStatus("Error: Initialization failed.");
            return; // Stop initialization
        }
    }

    // --- Final UI Updates and Start ---
    // Initial render needs to happen *after* currentPlayerIndex is set
    renderHands();

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) {
        console.error(`CRITICAL ERROR: Start index ${gameState.currentPlayerIndex} invalid.`);
        updateStatus("Error: Failed to set starting player.");
        return;
    }
    const startingPlayerName = currentPlayer.name;
    updateStatus(`Game started (${mode}). ${startingPlayerName}'s turn. Must play 4♥.`);
    console.log(`Game ready. Starting player index: ${gameState.currentPlayerIndex} (${startingPlayerName})`);

    // Show the correct game page and associated nav
    showPage(mode === '1v1' ? 'game-page-1v1' : 'game-page-3player');

    // If AI starts, trigger their turn
    if (gameState.currentPlayerIndex > 0) {
        if (gameState.players[gameState.currentPlayerIndex]) {
            gameState.players[gameState.currentPlayerIndex].lastReasoning = "Thinking...";
            renderHands(); // Show thinking status
        }
        console.log(`Scheduling initial AI turn for ${startingPlayerName} in ${AI_TURN_DELAY}ms`);
        setTimeout(() => {
            const startingAIPlayer = gameState.players[gameState.currentPlayerIndex];
            const currentPlayerId = startingAIPlayer?.id; // Get ID
            // Check state validity before triggering AI
            if (currentPlayerId && // Check player exists and has ID
                gameState.currentPlayerIndex === (currentPlayerId - 1) && // Ensure player index matches ID-1
                !gameState.isGameOver)
            {
                handleAITurn(gameState.currentPlayerIndex);
            } else {
                console.log(`Initial AI turn for P${gameState.currentPlayerIndex+1} skipped (state changed: GameOver=${gameState.isGameOver}, CurrentPlayer=${gameState.currentPlayerIndex}, ID Mismatch?)`);
            }
        }, AI_TURN_DELAY);
    }
}


// --- Global Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Reset stats on initial load ---
    totalGamesPlayed = 0;
    userWins = 0;
    updateStatsDisplay(); // Show 0s initially
    showPage('mode-selection-page'); // Start at mode selection

    // --- Mode Selection Buttons (on Home Page) ---
    const start3PlayerButton = document.getElementById('start-3player-button');
    const start1v1Button = document.getElementById('start-1v1-button');
    const showRulesFromSelection = document.getElementById('show-rules-from-selection');

    if (start3PlayerButton) {
        start3PlayerButton.addEventListener('click', () => initializeGame('3player'));
    } else { console.error("Start 3 Player button not found"); }

    if (start1v1Button) {
        start1v1Button.addEventListener('click', () => initializeGame('1v1'));
    } else { console.error("Start 1v1 button not found"); }

     if (showRulesFromSelection) {
        showRulesFromSelection.addEventListener('click', () => showPage('rules-page'));
    } else { console.error("Show Rules (from selection) button not found"); }


    // --- Top Navigation Button Listeners ---
    const navContainer = document.getElementById('nav-buttons-container');
    if (navContainer) {
        navContainer.addEventListener('click', (event) => {
            if (!event.target.matches('.nav-button')) return; // Ignore clicks not on buttons

            const buttonId = event.target.id;
            console.log("Nav button clicked:", buttonId);

            switch (buttonId) {
                // Rules Page Nav
                case 'nav-rules-to-3p':
                    initializeGame('3player');
                    break;
                case 'nav-rules-to-1v1':
                    initializeGame('1v1');
                    break;
                case 'nav-rules-to-mode':
                     showPage('mode-selection-page');
                    break;

                // 3 Player Game Nav
                case 'nav-3p-new':
                    // **MODIFIED**: Restart game in current mode (3p)
                    if (gameState.gameMode === '3player') {
                        initializeGame('3player');
                    } else {
                        console.warn("New game (3p) clicked, but current mode is not 3p. Re-initializing 3p.");
                        initializeGame('3player'); // Fallback or handle as error?
                    }
                    break;
                case 'nav-3p-to-1v1':
                    initializeGame('1v1'); // Start new 1v1 game directly
                    break;
                case 'nav-3p-to-rules':
                    showPage('rules-page');
                    break;

                // 1v1 Game Nav
                case 'nav-1v1-new':
                     // **MODIFIED**: Restart game in current mode (1v1)
                     if (gameState.gameMode === '1v1') {
                         initializeGame('1v1');
                     } else {
                         console.warn("New game (1v1) clicked, but current mode is not 1v1. Re-initializing 1v1.");
                         initializeGame('1v1'); // Fallback or handle as error?
                     }
                    break;
                case 'nav-1v1-to-3p':
                     initializeGame('3player'); // Start new 3p game directly
                    break;
                case 'nav-1v1-to-rules':
                     showPage('rules-page');
                    break;

                default:
                    console.warn("Unhandled nav button click:", buttonId);
            }
        });
    } else {
        console.error("Nav button container not found!");
    }


    // --- Action Buttons (Specific IDs per mode) ---
    // 3 Player
    const playButton3p = document.getElementById('play-button-3p');
    const passButton3p = document.getElementById('pass-button-3p');
    const clearButton3p = document.getElementById('clear-selection-button-3p');
    if (playButton3p) playButton3p.addEventListener('click', handlePlayAction);
    if (passButton3p) passButton3p.addEventListener('click', handlePassAction);
    if (clearButton3p) clearButton3p.addEventListener('click', handleClearSelection);

    // 1 vs 1
    const playButton1v1 = document.getElementById('play-button-1v1');
    const passButton1v1 = document.getElementById('pass-button-1v1');
    const clearButton1v1 = document.getElementById('clear-selection-button-1v1');
    if (playButton1v1) playButton1v1.addEventListener('click', handlePlayAction);
    if (passButton1v1) passButton1v1.addEventListener('click', handlePassAction);
    if (clearButton1v1) clearButton1v1.addEventListener('click', handleClearSelection);


    // --- AI Reasoning Toggles ---
    // **CORRECTED LOGIC**
    document.querySelectorAll('.ai-reasoning-toggle').forEach(toggle => {
        toggle.addEventListener('change', (event) => {
            const toggleId = event.target.id; // e.g., "ai-reasoning-toggle-3p"
            console.log(`Toggle changed: ${toggleId}`); // Log which toggle fired

            // Determine the correct game board ID based on the toggle's ID
            let gameBoardId = null;
            if (toggleId === 'ai-reasoning-toggle-3p') {
                gameBoardId = 'game-board-3player';
            } else if (toggleId === 'ai-reasoning-toggle-1v1') {
                gameBoardId = 'game-board-1v1';
            }

            console.log(`Looking for game board: ${gameBoardId}`); // Log the target board ID
            const gameBoard = gameBoardId ? document.getElementById(gameBoardId) : null;

            if (gameBoard) {
                console.log(`Found game board: ${gameBoard.id}`); // Confirm board found
                if (event.target.checked) {
                    gameBoard.classList.add('show-ai-reasoning');
                    console.log(`AI Reasoning for ${gameBoardId}: Shown`);
                } else {
                    gameBoard.classList.remove('show-ai-reasoning');
                    console.log(`AI Reasoning for ${gameBoardId}: Hidden`);
                }
            } else {
                 console.error(`Game board element not found for ID: ${gameBoardId} (triggered by ${toggleId})`);
            }
        });
    });

});
