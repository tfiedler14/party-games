import {
  ref,
  set,
  get,
  onValue,
  off,
  update,
} from 'firebase/database';
import { database } from './firebase';
import {
  IrishPokerGameState,
  IrishPokerPlayer,
  IrishPokerConfig,
  Lobby,
  IrishPokerHand,
} from '../types';
import {
  Card,
  createDeck,
  shuffleDeck,
  dealCards,
  ROUND_ORDER,
  RoundGuess,
  checkRedBlack,
  checkHigherLower,
  checkInBetween,
  checkSuit,
  countAces,
  DRINK_AMOUNTS,
  RedBlackGuess,
  HigherLowerGuess,
  InBetweenGuess,
  SuitGuess,
} from '../utils/cards';

/**
 * Normalize game state from Firebase (handles null/undefined in arrays)
 */
function normalizeGameState(state: any): IrishPokerGameState {
  if (!state) return state;
  
  // Normalize players array - Firebase might return object instead of array
  const playersData = state.players || [];
  const playersArray = Array.isArray(playersData) 
    ? playersData 
    : Object.values(playersData);
  
  const players = playersArray.map((player: any) => {
    // Handle visibleCards - Firebase preserves objects but might mess with array indices
    const visibleCardsData = player.hand?.visibleCards;
    let visibleCards: (Card | null)[] = [null, null, null, null];
    
    if (visibleCardsData) {
      if (Array.isArray(visibleCardsData)) {
        visibleCards = visibleCardsData.map((c: any) => c || null);
      } else if (typeof visibleCardsData === 'object') {
        // Firebase sometimes converts arrays to objects with numeric keys
        for (let i = 0; i < 4; i++) {
          if (visibleCardsData[i]) {
            visibleCards[i] = visibleCardsData[i];
          }
        }
      }
    }
    
    // Pad to length 4
    while (visibleCards.length < 4) {
      visibleCards.push(null);
    }

    return {
      ...player,
      hand: {
        visibleCards,
        guesses: ensureArray(player.hand?.guesses, 4),
        results: ensureArray(player.hand?.results, 4),
      },
      drinks: {
        assigned: player.drinks?.assigned || 0,
        consumed: player.drinks?.consumed || 0,
      },
      rtbHand: Array.isArray(player.rtbHand) 
        ? player.rtbHand 
        : Object.values(player.rtbHand || {}) as Card[],
    };
  });

  // Normalize turnOrder
  const turnOrderData = state.turnOrder || [];
  const turnOrder = Array.isArray(turnOrderData) 
    ? turnOrderData 
    : Object.values(turnOrderData);

  // Normalize deck
  const deckData = state.deck || [];
  const deck = Array.isArray(deckData) 
    ? deckData 
    : Object.values(deckData);

  return {
    ...state,
    players,
    turnOrder,
    deck,
    // Ensure rideTheBus is null not undefined
    rideTheBus: state.rideTheBus ?? null,
    // Ensure config is preserved
    config: state.config || { includeRideTheBus: false },
  };
}

/**
 * Ensure we have an array of the correct length (Firebase drops null values)
 */
function ensureArray<T>(arr: T[] | undefined | object, length: number): (T | null)[] {
  const result: (T | null)[] = [];
  
  // Handle object (Firebase converts arrays with gaps to objects)
  let sourceArray: any[];
  if (!arr) {
    sourceArray = [];
  } else if (Array.isArray(arr)) {
    sourceArray = arr;
  } else if (typeof arr === 'object') {
    sourceArray = [];
    for (let i = 0; i < length; i++) {
      sourceArray[i] = (arr as any)[i];
    }
  } else {
    sourceArray = [];
  }
  
  for (let i = 0; i < length; i++) {
    result.push(sourceArray[i] ?? null);
  }
  return result;
}

/**
 * Initialize a new Irish Poker game
 */
export async function initializeGame(
  lobbyCode: string,
  config: IrishPokerConfig
): Promise<IrishPokerGameState> {
  // Get lobby data to get players
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  const lobbySnapshot = await get(lobbyRef);

  if (!lobbySnapshot.exists()) {
    throw new Error('Lobby not found');
  }

  const lobby = lobbySnapshot.val() as Lobby;
  
  // Create and shuffle deck
  let deck = shuffleDeck(createDeck());

  // Deal 4 cards to each player
  const players: IrishPokerPlayer[] = lobby.players.map((player) => {
    const [hand, remainingDeck] = dealCards(deck, 4);
    deck = remainingDeck;

    return {
      playerId: player.id,
      playerName: player.name,
      isHost: player.isHost,
      hand: {
        visibleCards: hand, // Cards are dealt but shown face-down in UI
        guesses: [null, null, null, null],
        results: [null, null, null, null],
      },
      drinks: {
        assigned: 0,
        consumed: 0,
      },
      rtbHand: [], // Will be populated when RTB starts
    };
  });

  // Randomize turn order (or keep host first)
  const turnOrder = players.map(p => p.playerId);

  const gameState: IrishPokerGameState = {
    lobbyCode,
    config,
    deck,
    players,
    turnOrder,
    currentRound: 0,
    currentPlayerIndex: 0,
    roundType: ROUND_ORDER[0],
    phase: 'main',
    rideTheBus: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Save to Firebase
  await set(ref(database, `games/${lobbyCode}`), gameState);

  // Update lobby status
  await update(lobbyRef, { status: 'playing', gameType: 'irish-poker' });

  return gameState;
}

/**
 * Replay the game with the same players and config
 */
export async function replayGame(lobbyCode: string): Promise<IrishPokerGameState> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const oldGameState = normalizeGameState(snapshot.val());
  const config = oldGameState.config!;
  
  // Create and shuffle a fresh deck
  let deck = shuffleDeck(createDeck());

  // Reset all players with new cards
  const players: IrishPokerPlayer[] = oldGameState.players.map((player) => {
    const [hand, remainingDeck] = dealCards(deck, 4);
    deck = remainingDeck;

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      isHost: player.isHost,
      hand: {
        visibleCards: hand,
        guesses: [null, null, null, null],
        results: [null, null, null, null],
      },
      drinks: {
        assigned: 0,
        consumed: 0,
      },
      rtbHand: [],
    };
  });

  // Randomize turn order for variety
  const turnOrder = [...players.map(p => p.playerId)].sort(() => Math.random() - 0.5);

  const gameState: IrishPokerGameState = {
    lobbyCode,
    config,
    deck,
    players,
    turnOrder,
    currentRound: 0,
    currentPlayerIndex: 0,
    roundType: ROUND_ORDER[0],
    phase: 'main',
    rideTheBus: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Save to Firebase (overwrites old game)
  await set(gameRef, gameState);

  console.log('Game replayed! New turn order:', turnOrder.map(id => 
    players.find(p => p.playerId === id)?.playerName
  ));

  return gameState;
}

/**
 * Subscribe to game state updates
 */
export function subscribeToGame(
  lobbyCode: string,
  callback: (gameState: IrishPokerGameState | null) => void
): () => void {
  const gameRef = ref(database, `games/${lobbyCode}`);

  const listener = onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      const normalized = normalizeGameState(snapshot.val());
      callback(normalized);
    } else {
      callback(null);
    }
  });

  return () => off(gameRef);
}

/**
 * Get current player whose turn it is
 */
export function getCurrentPlayer(gameState: IrishPokerGameState): IrishPokerPlayer {
  const playerId = gameState.turnOrder[gameState.currentPlayerIndex];
  return gameState.players.find(p => p.playerId === playerId)!;
}

/**
 * Submit a guess for the current round
 */
export async function submitGuess(
  lobbyCode: string,
  playerId: string,
  guess: RoundGuess
): Promise<{ correct: boolean; drinksToAssign: number; drinksToTake: number }> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());

  // Debug logging
  console.log('Submit guess - Game state:', {
    currentRound: gameState.currentRound,
    currentPlayerIndex: gameState.currentPlayerIndex,
    turnOrder: gameState.turnOrder,
    playerId,
  });

  // Verify it's this player's turn
  const currentPlayerId = gameState.turnOrder[gameState.currentPlayerIndex];
  if (currentPlayerId !== playerId) {
    console.error('Not your turn:', { currentPlayerId, playerId });
    throw new Error('Not your turn');
  }

  // Find player
  const playerIndex = gameState.players.findIndex(p => p.playerId === playerId);
  if (playerIndex === -1) {
    throw new Error('Player not found in game');
  }
  
  const player = gameState.players[playerIndex];
  const round = gameState.currentRound;

  // Get the card for this round (already dealt, just revealing)
  const card = player.hand.visibleCards[round];
  
  if (!card) {
    console.error('Card not found:', { round, visibleCards: player.hand.visibleCards });
    throw new Error('Card not found for this round');
  }

  console.log('Checking guess:', { round, card, guess });

  // Check if guess is correct based on round type
  let correct = false;
  const previousCards = player.hand.visibleCards.slice(0, round).filter((c): c is Card => c !== null);

  switch (gameState.roundType) {
    case 'red-black':
      correct = checkRedBlack(card, guess as RedBlackGuess);
      break;

    case 'higher-lower':
      const prevCard = player.hand.visibleCards[0];
      if (!prevCard) {
        throw new Error('Previous card not found for higher-lower');
      }
      const aceCount = countAces(previousCards);
      correct = checkHigherLower(card, prevCard, guess as HigherLowerGuess, aceCount);
      break;

    case 'in-between':
      const card1 = player.hand.visibleCards[0];
      const card2 = player.hand.visibleCards[1];
      if (!card1 || !card2) {
        throw new Error('Previous cards not found for in-between');
      }
      const acesBeforeRound3 = countAces(previousCards);
      correct = checkInBetween(card, card1, card2, guess as InBetweenGuess, acesBeforeRound3);
      break;

    case 'suit':
      correct = checkSuit(card, guess as SuitGuess);
      break;
  }

  // Calculate drinks
  const drinksToTake = correct ? 0 : DRINK_AMOUNTS.wrong[round];
  const drinksToAssign = correct ? DRINK_AMOUNTS.right[round] : 0;

  // Update player state
  player.hand.guesses[round] = guess;
  player.hand.results[round] = correct;

  if (!correct) {
    player.drinks.assigned += drinksToTake;
  }

  // Move to next player or next round
  let nextPlayerIndex = gameState.currentPlayerIndex + 1;
  let nextRound = gameState.currentRound;
  let nextRoundType = gameState.roundType;
  let phase = gameState.phase;

  if (nextPlayerIndex >= gameState.turnOrder.length) {
    // All players have gone this round, move to next round
    nextPlayerIndex = 0;
    nextRound = gameState.currentRound + 1;

    if (nextRound >= 4) {
      // Main game complete
      console.log('Main game complete! Config:', gameState.config);
      console.log('Include Ride the Bus:', gameState.config?.includeRideTheBus);
      
      if (gameState.config?.includeRideTheBus) {
        console.log('Initiating Ride the Bus phase');
        phase = 'ride-the-bus';
        // Initialize Ride the Bus state
        const deckArray = Array.isArray(gameState.deck) ? gameState.deck : Object.values(gameState.deck || {});
        const [giveCards, deckAfterGive] = dealCards(deckArray as Card[], 4);
        const [takeCards, deckAfterTake] = dealCards(deckAfterGive, 4);
        
        gameState.deck = deckAfterTake;
        
        // Initialize each player's RTB hand with their original cards
        gameState.players.forEach(p => {
          const originalCards = p.hand?.visibleCards || [];
          p.rtbHand = originalCards.filter((c): c is Card => c !== null);
        });
        
        gameState.rideTheBus = {
          phase: 'flip',
          giveRow: giveCards,
          takeRow: takeCards,
          currentFlipIndex: 0,
          currentFlipCard: null,
          waitingForAssignment: false,
          waitingForDrinkAck: false,
          matchingPlayerIds: [],
          riderId: null,
          riderCards: [null, null, null, null],
          riderRound: 0,
          riderCardRevealed: false,
          riderLastGuess: null,
        };
        console.log('Ride the Bus state:', gameState.rideTheBus);
      } else {
        console.log('Ride the Bus not enabled, game complete');
        phase = 'complete';
      }
    } else {
      nextRoundType = ROUND_ORDER[nextRound];
    }
  }

  // Update game state - Firebase doesn't allow undefined, use null instead
  const updates: Record<string, any> = {
    players: gameState.players,
    currentPlayerIndex: nextPlayerIndex,
    currentRound: nextRound,
    roundType: nextRoundType,
    phase,
    deck: gameState.deck,
    updatedAt: Date.now(),
  };
  
  // Only include rideTheBus if it's not undefined
  if (gameState.rideTheBus !== undefined) {
    updates.rideTheBus = gameState.rideTheBus;
  } else {
    updates.rideTheBus = null;
  }

  await update(gameRef, updates);

  return { correct, drinksToAssign, drinksToTake };
}

/**
 * Assign drinks to another player (after correct guess)
 */
export async function assignDrinks(
  lobbyCode: string,
  fromPlayerId: string,
  toPlayerId: string,
  amount: number
): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = snapshot.val() as IrishPokerGameState;
  const targetPlayer = gameState.players.find(p => p.playerId === toPlayerId);

  if (!targetPlayer) {
    throw new Error('Target player not found');
  }

  targetPlayer.drinks.assigned += amount;

  await update(gameRef, {
    players: gameState.players,
    updatedAt: Date.now(),
  });
}

/**
 * Record drinks consumed by a player (capped at assigned amount)
 */
export async function recordDrinksConsumed(
  lobbyCode: string,
  playerId: string,
  amount: number
): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const player = gameState.players.find(p => p.playerId === playerId);

  if (!player) {
    throw new Error('Player not found');
  }

  // Cap consumed at assigned amount
  const newConsumed = player.drinks.consumed + amount;
  player.drinks.consumed = Math.min(newConsumed, player.drinks.assigned);

  await update(gameRef, {
    players: gameState.players,
    updatedAt: Date.now(),
  });
}

/**
 * Flip a card during Ride the Bus - updates Firebase state so all players see it
 */
export async function flipRideTheBusCard(
  lobbyCode: string
): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const rtb = gameState.rideTheBus;

  if (!rtb || (rtb.phase !== 'flip' && rtb.phase !== 'overtime')) {
    throw new Error('Not in flip phase');
  }

  // Don't allow flipping if already waiting for action
  if (rtb.waitingForAssignment || rtb.waitingForDrinkAck) {
    console.log('Already waiting for action, ignoring flip');
    return;
  }

  const flipIndex = rtb.currentFlipIndex;
  const isGiveRow = rtb.phase === 'overtime' ? true : (flipIndex % 2 === 0);
  const rowIndex = rtb.phase === 'overtime' 
    ? flipIndex - 8
    : Math.floor(flipIndex / 2);
  
  // Normalize arrays
  let giveRow = Array.isArray(rtb.giveRow) ? rtb.giveRow : Object.values(rtb.giveRow || {}) as Card[];
  let takeRow = Array.isArray(rtb.takeRow) ? rtb.takeRow : Object.values(rtb.takeRow || {}) as Card[];
  let deckArray = Array.isArray(gameState.deck) ? gameState.deck : Object.values(gameState.deck || {}) as Card[];
  
  // Get current card
  let card: Card | null = isGiveRow ? giveRow[rowIndex] : takeRow[rowIndex];
  
  // Find matching players - check rtbHand (current cards during RTB)
  let matchingPlayers = gameState.players
    .filter(p => {
      const rtbHand = Array.isArray(p.rtbHand) ? p.rtbHand : Object.values(p.rtbHand || {}) as Card[];
      return rtbHand.some(c => c && c.rank === card!.rank);
    })
    .map(p => p.playerId);

  // Auto-replace while no one has the card (max 20 attempts)
  let attempts = 0;
  while (matchingPlayers.length === 0 && attempts < 20 && deckArray.length > 0) {
    attempts++;
    console.log(`No one has rank ${card?.rank}, auto-replacing... (attempt ${attempts})`);
    
    // Draw new card
    const [newCards, remainingDeck] = dealCards(deckArray, 1);
    card = newCards[0];
    deckArray = remainingDeck;
    
    // Replace in row
    if (isGiveRow) {
      giveRow[rowIndex] = card;
    } else {
      takeRow[rowIndex] = card;
    }
    
    // Re-check matching players using rtbHand
    matchingPlayers = gameState.players
      .filter(p => {
        const rtbHand = Array.isArray(p.rtbHand) ? p.rtbHand : Object.values(p.rtbHand || {}) as Card[];
        return rtbHand.some(c => c && c.rank === card!.rank);
      })
      .map(p => p.playerId);
  }

  console.log('Flip result:', { card: card?.id, rank: card?.rank, matchingPlayers, isGiveRow });

  // Update state
  rtb.giveRow = giveRow;
  rtb.takeRow = takeRow;
  rtb.currentFlipCard = card;
  rtb.matchingPlayerIds = matchingPlayers;
  rtb.waitingForAssignment = isGiveRow && matchingPlayers.length > 0;
  rtb.waitingForDrinkAck = !isGiveRow && matchingPlayers.length > 0;

  await update(gameRef, {
    rideTheBus: rtb,
    deck: deckArray,
    updatedAt: Date.now(),
  });
}

/**
 * Process a card flip during Ride the Bus flip phase (legacy - returns info only)
 */
export async function processRideTheBusFlip(
  lobbyCode: string
): Promise<{
  card: Card;
  isGiveRow: boolean;
  matchingPlayers: string[];
}> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const rtb = gameState.rideTheBus;

  if (!rtb || (rtb.phase !== 'flip' && rtb.phase !== 'overtime')) {
    throw new Error('Not in flip phase');
  }

  // If we already have a flipped card, return that info
  if (rtb.currentFlipCard) {
    const flipIndex = rtb.currentFlipIndex;
    const isGiveRow = rtb.phase === 'overtime' ? true : (flipIndex % 2 === 0);
    return {
      card: rtb.currentFlipCard,
      isGiveRow,
      matchingPlayers: rtb.matchingPlayerIds || [],
    };
  }

  const flipIndex = rtb.currentFlipIndex;
  const isGiveRow = rtb.phase === 'overtime' ? true : (flipIndex % 2 === 0);
  const rowIndex = rtb.phase === 'overtime' 
    ? flipIndex - 8
    : Math.floor(flipIndex / 2);
  
  const giveRow = Array.isArray(rtb.giveRow) ? rtb.giveRow : Object.values(rtb.giveRow || {});
  const takeRow = Array.isArray(rtb.takeRow) ? rtb.takeRow : Object.values(rtb.takeRow || {});
  
  const card = isGiveRow ? giveRow[rowIndex] as Card : takeRow[rowIndex] as Card;

  if (!card) {
    throw new Error('No card found at current position');
  }

  const matchingPlayers = gameState.players
    .filter(p => {
      const visibleCards = p.hand?.visibleCards || [];
      return visibleCards.some(c => c && c.rank === card!.rank);
    })
    .map(p => p.playerId);

  return { card, isGiveRow, matchingPlayers };
}

/**
 * Acknowledge drink and advance (for TAKE row)
 */
export async function acknowledgeDrinkAndAdvance(
  lobbyCode: string
): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const rtb = gameState.rideTheBus!;
  
  // Clear flip state and advance
  rtb.currentFlipIndex += 1;
  rtb.currentFlipCard = null;
  rtb.waitingForAssignment = false;
  rtb.waitingForDrinkAck = false;
  rtb.matchingPlayerIds = [];

  // Check if flip phase is complete
  if (rtb.currentFlipIndex >= 8) {
    await checkFlipPhaseComplete(gameState, rtb, gameRef);
  } else {
    await update(gameRef, {
      rideTheBus: rtb,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Advance the flip index without assigning a card (legacy)
 */
export async function advanceRideTheBusFlip(
  lobbyCode: string
): Promise<void> {
  return acknowledgeDrinkAndAdvance(lobbyCode);
}

/**
 * Check if flip phase is complete and determine who rides
 * The player with the MOST cards in their rtbHand rides the bus
 */
async function checkFlipPhaseComplete(
  gameState: IrishPokerGameState,
  rtb: any,
  gameRef: any
): Promise<void> {
  // Count cards in each player's rtbHand
  const cardCounts = gameState.players.map(p => {
    const hand = Array.isArray(p.rtbHand) ? p.rtbHand : Object.values(p.rtbHand || {}) as Card[];
    return { playerId: p.playerId, count: hand.length, name: p.playerName };
  });
  
  console.log('Card counts:', cardCounts);
  
  const maxCards = Math.max(...cardCounts.map(c => c.count));
  const playersWithMax = cardCounts.filter(c => c.count === maxCards);

  if (playersWithMax.length === 1) {
    // One clear loser (most cards)
    console.log(`${playersWithMax[0].name} rides the bus with ${maxCards} cards!`);
    rtb.phase = 'riding';
    rtb.riderId = playersWithMax[0].playerId;
    // Deal first card for riding (face-down until guess)
    const deckArray = Array.isArray(gameState.deck) ? gameState.deck : Object.values(gameState.deck || {}) as Card[];
    const [riderCards, remainingDeck] = dealCards(deckArray, 1);
    rtb.riderCards = [riderCards[0], null, null, null];
    rtb.riderCardRevealed = false;
    rtb.riderLastGuess = null;
    gameState.deck = remainingDeck;
  } else {
    // Tie - go to overtime (keep flipping GIVE cards until tie is broken)
    console.log(`Tie between ${playersWithMax.map(p => p.name).join(', ')} with ${maxCards} cards - OVERTIME!`);
    rtb.phase = 'overtime';
  }

  await update(gameRef, {
    players: gameState.players,
    rideTheBus: rtb,
    deck: gameState.deck,
    updatedAt: Date.now(),
  });
}

/**
 * Give a card from one player to another during Ride the Bus
 * fromPlayerId gives a card of the matching rank to toPlayerId
 * Auto-advances when no more matching cards remain across all players
 */
export async function giveRideTheBusCard(
  lobbyCode: string,
  fromPlayerId: string,
  toPlayerId: string,
  cardRank: number
): Promise<{ cardsRemaining: number; totalRemaining: number }> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const rtb = gameState.rideTheBus;
  
  // Check if we're still waiting for assignment (prevent duplicate calls)
  if (!rtb || !rtb.waitingForAssignment) {
    console.log('Not waiting for assignment, ignoring give card request');
    return { cardsRemaining: 0, totalRemaining: 0 };
  }
  
  const fromPlayer = gameState.players.find(p => p.playerId === fromPlayerId);
  const toPlayer = gameState.players.find(p => p.playerId === toPlayerId);

  if (!fromPlayer || !toPlayer) {
    throw new Error('Player not found');
  }

  // Normalize rtbHand arrays
  let fromHand: Card[] = Array.isArray(fromPlayer.rtbHand) 
    ? fromPlayer.rtbHand 
    : Object.values(fromPlayer.rtbHand || {}) as Card[];
  let toHand: Card[] = Array.isArray(toPlayer.rtbHand) 
    ? toPlayer.rtbHand 
    : Object.values(toPlayer.rtbHand || {}) as Card[];

  // Find the first card of matching rank in fromPlayer's hand
  const cardIndex = fromHand.findIndex(c => c && c.rank === cardRank);
  
  if (cardIndex === -1) {
    // Card already given (race condition) - just return current counts
    console.log('Card not found - likely already given');
    const totalRemaining = gameState.players.reduce((sum, p) => {
      const hand: Card[] = Array.isArray(p.rtbHand) ? p.rtbHand : Object.values(p.rtbHand || {}) as Card[];
      return sum + hand.filter(c => c && c.rank === cardRank).length;
    }, 0);
    return { cardsRemaining: 0, totalRemaining };
  }

  // Remove card from giver and add to receiver
  const [card] = fromHand.splice(cardIndex, 1);
  toHand.push(card);

  // Update player hands
  fromPlayer.rtbHand = fromHand;
  toPlayer.rtbHand = toHand;

  // Count remaining cards of this rank in the giver's hand
  const cardsRemaining = fromHand.filter(c => c && c.rank === cardRank).length;

  console.log(`Card given: ${card.id} from ${fromPlayer.playerName} to ${toPlayer.playerName}`);
  console.log(`${fromPlayer.playerName} has ${cardsRemaining} more cards of rank ${cardRank}`);

  // Only count cards from ORIGINAL matching players (not receivers)
  // This prevents the ping-pong bug where received cards can be given back
  const originalMatchingPlayerIds = rtb.matchingPlayerIds || [];
  
  // Count remaining cards only from players who originally had matching cards
  const totalRemaining = gameState.players
    .filter(p => originalMatchingPlayerIds.includes(p.playerId))
    .reduce((sum, p) => {
      const hand: Card[] = Array.isArray(p.rtbHand) ? p.rtbHand : Object.values(p.rtbHand || {}) as Card[];
      return sum + hand.filter(c => c && c.rank === cardRank).length;
    }, 0);

  console.log(`Total cards of rank ${cardRank} remaining (from original holders): ${totalRemaining}`);

  // If no more cards from original holders remain, auto-advance to next flip
  if (totalRemaining === 0) {
    console.log('All cards from original holders given - auto-advancing');
    rtb.currentFlipIndex += 1;
    rtb.currentFlipCard = null;
    rtb.waitingForAssignment = false;
    rtb.waitingForDrinkAck = false;
    rtb.matchingPlayerIds = [];

    // Check if flip phase is complete
    if (rtb.currentFlipIndex >= 8) {
      await checkFlipPhaseComplete(gameState, rtb, gameRef);
    } else {
      await update(gameRef, {
        players: gameState.players,
        rideTheBus: rtb,
        updatedAt: Date.now(),
      });
    }
  } else {
    // Remove the giver from matching players if they have no more cards of this rank
    // But do NOT add receivers - only original holders can give
    const updatedMatchingPlayerIds = originalMatchingPlayerIds.filter(playerId => {
      const player = gameState.players.find(p => p.playerId === playerId);
      if (!player) return false;
      const hand: Card[] = Array.isArray(player.rtbHand) ? player.rtbHand : Object.values(player.rtbHand || {}) as Card[];
      return hand.some(c => c && c.rank === cardRank);
    });
    
    rtb.matchingPlayerIds = updatedMatchingPlayerIds;

    await update(gameRef, {
      players: gameState.players,
      rideTheBus: rtb,
      updatedAt: Date.now(),
    });
  }

  return { cardsRemaining, totalRemaining };
}

/**
 * Done giving cards - advance to next flip
 */
export async function finishGivingCards(
  lobbyCode: string
): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const rtb = gameState.rideTheBus!;

  // Clear flip state and advance
  rtb.currentFlipIndex += 1;
  rtb.currentFlipCard = null;
  rtb.waitingForAssignment = false;
  rtb.waitingForDrinkAck = false;
  rtb.matchingPlayerIds = [];

  // Check if flip phase is complete
  if (rtb.currentFlipIndex >= 8) {
    await checkFlipPhaseComplete(gameState, rtb, gameRef);
  } else {
    await update(gameRef, {
      rideTheBus: rtb,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Assign a card to a player during Ride the Bus flip phase (legacy - use giveRideTheBusCard instead)
 */
export async function assignRideTheBusCard(
  lobbyCode: string,
  toPlayerId: string
): Promise<void> {
  // This is now just a wrapper for backwards compatibility
  await finishGivingCards(lobbyCode);
}

/**
 * Submit a guess during Ride the Bus riding phase
 */
export async function submitRiderGuess(
  lobbyCode: string,
  guess: RoundGuess
): Promise<{ correct: boolean; escaped: boolean }> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const rtb = gameState.rideTheBus!;

  if (rtb.phase !== 'riding') {
    throw new Error('Not in riding phase');
  }

  const round = rtb.riderRound || 0;
  const riderCardsRaw = rtb.riderCards;
  const riderCards: (Card | null)[] = Array.isArray(riderCardsRaw) 
    ? riderCardsRaw 
    : [riderCardsRaw?.[0] || null, riderCardsRaw?.[1] || null, riderCardsRaw?.[2] || null, riderCardsRaw?.[3] || null];
  
  const card = riderCards[round] as Card | null;
  
  if (!card) {
    throw new Error('No card dealt for current round');
  }
  
  const previousCards = riderCards.slice(0, round).filter((c): c is Card => c !== null);
  
  console.log('Rider guess:', { round, cardId: card.id, guess, previousCardsCount: previousCards.length });

  // Check guess
  let correct = false;

  switch (round) {
    case 0: // Red/Black
      correct = checkRedBlack(card, guess as RedBlackGuess);
      break;
    case 1: // Higher/Lower
      const aceCount = countAces(previousCards);
      correct = checkHigherLower(card, previousCards[0], guess as HigherLowerGuess, aceCount);
      break;
    case 2: // In-Between
      const acesBeforeRound3 = countAces(previousCards);
      correct = checkInBetween(card, previousCards[0], previousCards[1], guess as InBetweenGuess, acesBeforeRound3);
      break;
    case 3: // Suit
      correct = checkSuit(card, guess as SuitGuess);
      break;
  }

  // Normalize deck
  let deckArray = Array.isArray(gameState.deck) ? gameState.deck : Object.values(gameState.deck || {}) as Card[];
  
  // Make riderCards mutable
  let updatedRiderCards: (Card | null)[] = [...riderCards];

  const escaped = correct && round === 3;
  
  // Reveal the card and store the result
  rtb.riderCardRevealed = true;
  rtb.riderLastGuess = { correct, escaped };
  
  console.log(`Guess result: ${correct ? 'CORRECT' : 'WRONG'}${escaped ? ' - ESCAPED!' : ''}`);

  if (escaped) {
    // Escaped! Game complete
    rtb.phase = 'complete';
    gameState.phase = 'complete';
  } else if (!correct) {
    // Wrong - add a drink (but don't restart yet - wait for Continue)
    const rider = gameState.players.find(p => p.playerId === rtb.riderId);
    if (rider) {
      rider.drinks.assigned += 1;
    }
  }
  // If correct but not escaped, wait for Continue to advance

  rtb.riderCards = updatedRiderCards;

  await update(gameRef, {
    rideTheBus: rtb,
    phase: gameState.phase,
    players: gameState.players,
    updatedAt: Date.now(),
  });

  return { correct, escaped };
}

/**
 * Continue after seeing rider guess result - advances to next round or restarts
 */
export async function continueRiding(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const rtb = gameState.rideTheBus!;

  if (!rtb.riderLastGuess) {
    throw new Error('No guess result to continue from');
  }

  const { correct } = rtb.riderLastGuess;
  const round = rtb.riderRound || 0;
  
  // Normalize deck
  let deckArray = Array.isArray(gameState.deck) ? gameState.deck : Object.values(gameState.deck || {}) as Card[];
  let updatedRiderCards: (Card | null)[] = Array.isArray(rtb.riderCards) 
    ? [...rtb.riderCards] 
    : [rtb.riderCards?.[0] || null, rtb.riderCards?.[1] || null, rtb.riderCards?.[2] || null, rtb.riderCards?.[3] || null];

  if (correct) {
    // Advance to next round, deal next card face-down
    rtb.riderRound = round + 1;
    const [newCards, remainingDeck] = dealCards(deckArray, 1);
    updatedRiderCards[round + 1] = newCards[0];
    deckArray = remainingDeck;
  } else {
    // Wrong - restart from beginning
    rtb.riderRound = 0;
    updatedRiderCards = [null, null, null, null];
    const [newCards, remainingDeck] = dealCards(deckArray, 1);
    updatedRiderCards[0] = newCards[0];
    deckArray = remainingDeck;
  }

  // Reset for next guess
  rtb.riderCardRevealed = false;
  rtb.riderLastGuess = null;
  rtb.riderCards = updatedRiderCards;
  gameState.deck = deckArray;

  await update(gameRef, {
    rideTheBus: rtb,
    deck: gameState.deck,
    updatedAt: Date.now(),
  });
}

/**
 * Replace a card during flip phase when no one matches
 */
export async function replaceFlipCard(
  lobbyCode: string
): Promise<Card> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const rtb = gameState.rideTheBus!;

  const flipIndex = rtb.currentFlipIndex;
  const isGiveRow = rtb.phase === 'overtime' ? true : (flipIndex % 2 === 0);
  const rowIndex = rtb.phase === 'overtime' 
    ? flipIndex - 8 
    : Math.floor(flipIndex / 2);

  // Normalize deck
  const deckArray = Array.isArray(gameState.deck) ? gameState.deck : Object.values(gameState.deck || {}) as Card[];
  
  if (deckArray.length === 0) {
    throw new Error('Deck is empty');
  }

  // Draw new card
  const [newCards, remainingDeck] = dealCards(deckArray, 1);
  const newCard = newCards[0];
  gameState.deck = remainingDeck;

  // Replace the card in the appropriate row
  // Ensure arrays exist
  if (!Array.isArray(rtb.giveRow)) {
    rtb.giveRow = Object.values(rtb.giveRow || {});
  }
  if (!Array.isArray(rtb.takeRow)) {
    rtb.takeRow = Object.values(rtb.takeRow || {});
  }

  if (isGiveRow) {
    rtb.giveRow[rowIndex] = newCard;
  } else {
    rtb.takeRow[rowIndex] = newCard;
  }

  console.log('Replaced card at index', rowIndex, 'with', newCard.id);

  await update(gameRef, {
    rideTheBus: rtb,
    deck: gameState.deck,
    updatedAt: Date.now(),
  });

  return newCard;
}
