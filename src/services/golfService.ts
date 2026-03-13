import { ref, set, get, onValue, off, update } from 'firebase/database';
import { database } from './firebase';
import {
  GolfGameState,
  GolfPlayerState,
  GolfConfig,
  GolfCard,
  GolfVariant,
} from '../types';
import { Card, createDeck, shuffleDeck } from '../utils/cards';

function getGridSize(variant: GolfVariant): number {
  return variant === '4-card' ? 4 : variant === '6-card' ? 6 : 9;
}

function getColumns(variant: GolfVariant): number {
  return variant === '4-card' ? 2 : 3;
}

function getRows(variant: GolfVariant): number {
  return variant === '4-card' ? 2 : variant === '6-card' ? 2 : 3;
}

/** Score a single card */
function cardScore(card: Card): number {
  if (card.rank === 11) return 0;   // Jack = 0
  if (card.rank === 1) return 1;    // Ace = 1
  if (card.rank >= 12) return 10;   // Queen, King = 10
  return card.rank;                  // 2-10 = face value
}

/** Calculate score for a player's grid, applying column matching rules */
export function calculateGridScore(grid: (GolfCard | null)[], variant: GolfVariant): number {
  const cols = getColumns(variant);
  const rows = getRows(variant);
  let score = 0;

  for (let col = 0; col < cols; col++) {
    const colCards: Card[] = [];
    for (let row = 0; row < rows; row++) {
      const cell = grid[row * cols + col];
      if (cell) colCards.push(cell.card);
    }

    if (colCards.length === rows) {
      const allMatch = colCards.every(c => c.rank === colCards[0].rank);
      if (variant === '9-card' && rows === 3 && allMatch) {
        // 9-card: 3-of-a-kind in column = 0
        continue;
      }
      if (rows >= 2 && allMatch) {
        // Pairs rule: matching column = 0
        continue;
      }
    }
    // Sum individual cards
    for (const c of colCards) {
      score += cardScore(c);
    }
  }
  return score;
}

function normalizeState(state: any): GolfGameState | null {
  if (!state) return null;
  const playersData = state.players || [];
  const players = (Array.isArray(playersData) ? playersData : Object.values(playersData)).map((p: any) => ({
    ...p,
    grid: normalizeArray(p.grid, getGridSize(state.config?.variant || '6-card')),
    roundScores: Array.isArray(p.roundScores) ? p.roundScores : Object.values(p.roundScores || {}),
  }));
  
  const turnOrder = Array.isArray(state.turnOrder) ? state.turnOrder : Object.values(state.turnOrder || {});
  const deck = Array.isArray(state.deck) ? state.deck : Object.values(state.deck || {});
  const discardPile = Array.isArray(state.discardPile) ? state.discardPile : Object.values(state.discardPile || {});
  const finalTurnPlayerIds = Array.isArray(state.finalTurnPlayerIds) ? state.finalTurnPlayerIds : Object.values(state.finalTurnPlayerIds || {});
  
  return {
    ...state,
    players,
    turnOrder: turnOrder as string[],
    deck: deck as Card[],
    discardPile: discardPile as Card[],
    finalTurnPlayerIds: finalTurnPlayerIds as string[],
    drawnCard: state.drawnCard ?? null,
    drawnFrom: state.drawnFrom ?? null,
    knockerId: state.knockerId ?? null,
    initialFlipsRemaining: state.initialFlipsRemaining || {},
  };
}

function normalizeArray(arr: any, length: number): any[] {
  if (!arr) return new Array(length).fill(null);
  if (Array.isArray(arr)) return arr;
  const result: any[] = [];
  for (let i = 0; i < length; i++) {
    result[i] = arr[i] ?? null;
  }
  return result;
}

export async function initializeGolf(lobbyCode: string, config: GolfConfig): Promise<GolfGameState> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  const snap = await get(lobbyRef);
  if (!snap.exists()) throw new Error('Lobby not found');
  const lobby = snap.val();
  const lobbyPlayers = Array.isArray(lobby.players) ? lobby.players : Object.values(lobby.players || {});

  const gridSize = getGridSize(config.variant);
  let deck = shuffleDeck(createDeck());

  const players: GolfPlayerState[] = lobbyPlayers.map((p: any) => {
    const grid: GolfCard[] = [];
    for (let i = 0; i < gridSize; i++) {
      grid.push({ card: deck.shift()!, faceUp: false });
    }
    return {
      playerId: p.id,
      playerName: p.name,
      isHost: p.isHost || false,
      grid,
      roundScores: [],
      totalScore: 0,
      allFaceUp: false,
    };
  });

  const turnOrder = players.map(p => p.playerId);
  // Shuffle turn order
  for (let i = turnOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
  }

  // First card to discard pile
  const firstDiscard = deck.shift()!;

  const initialFlips: Record<string, number> = {};
  players.forEach(p => { initialFlips[p.playerId] = 2; });

  const gameState: GolfGameState = {
    lobbyCode,
    config,
    players,
    turnOrder,
    deck,
    discardPile: [firstDiscard],
    currentPlayerIndex: 0,
    currentRound: 0,
    drawnCard: null,
    drawnFrom: null,
    knockerId: null,
    finalTurnPlayerIds: [],
    initialFlipsRemaining: initialFlips,
    phase: 'flip-initial',
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  await set(ref(database, `games/${lobbyCode}/golf`), gameState);
  await update(ref(database, `lobbies/${lobbyCode}`), { status: 'playing', gameType: 'golf' });
  return gameState;
}

export function subscribeToGolf(lobbyCode: string, callback: (state: GolfGameState) => void): () => void {
  const gameRef = ref(database, `games/${lobbyCode}/golf`);
  const handler = (snapshot: any) => {
    if (snapshot.exists()) {
      const normalized = normalizeState(snapshot.val());
      if (normalized) callback(normalized);
    }
  };
  onValue(gameRef, handler);
  return () => off(gameRef, 'value', handler);
}

/** Flip a face-down card during initial phase */
export async function flipInitialCard(lobbyCode: string, playerId: string, cardIndex: number): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/golf`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state || state.phase !== 'flip-initial') return;

  const remaining = state.initialFlipsRemaining[playerId] ?? 0;
  if (remaining <= 0) return;

  const player = state.players.find(p => p.playerId === playerId);
  if (!player) return;

  const cell = player.grid[cardIndex];
  if (!cell || cell.faceUp) return;

  cell.faceUp = true;
  state.initialFlipsRemaining[playerId] = remaining - 1;
  state.updatedAt = Date.now();

  // Check if all players done flipping
  const allDone = Object.values(state.initialFlipsRemaining).every((v: any) => v <= 0);
  if (allDone) {
    state.phase = 'playing';
  }

  await set(gameRef, state);
}

/** Draw a card from deck or discard pile */
export async function drawCard(lobbyCode: string, playerId: string, source: 'deck' | 'discard'): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/golf`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state || (state.phase !== 'playing' && state.phase !== 'final-turns')) return;

  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== playerId || state.drawnCard) return;

  let card: Card;
  if (source === 'deck') {
    if (state.deck.length === 0) return;
    card = state.deck.shift()!;
  } else {
    if (state.discardPile.length === 0) return;
    card = state.discardPile.pop()!;
  }

  state.drawnCard = card;
  state.drawnFrom = source;
  state.updatedAt = Date.now();
  await set(gameRef, state);
}

/** Swap drawn card with a card in grid */
export async function swapCard(lobbyCode: string, playerId: string, cardIndex: number): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/golf`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state || !state.drawnCard) return;

  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== playerId) return;

  const player = state.players.find(p => p.playerId === playerId);
  if (!player) return;

  const oldCard = player.grid[cardIndex];
  if (!oldCard) return;

  // Put old card on discard pile (face up)
  state.discardPile.push(oldCard.card);
  // Replace with drawn card (face up)
  player.grid[cardIndex] = { card: state.drawnCard, faceUp: true };
  state.drawnCard = null;
  state.drawnFrom = null;
  state.updatedAt = Date.now();

  await finishTurn(state, gameRef);
}

/** Discard the drawn card (and optionally flip a face-down card) */
export async function discardDrawnCard(lobbyCode: string, playerId: string, flipIndex?: number): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/golf`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state || !state.drawnCard) return;

  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== playerId) return;

  const player = state.players.find(p => p.playerId === playerId);
  if (!player) return;

  state.discardPile.push(state.drawnCard);
  state.drawnCard = null;
  state.drawnFrom = null;

  // If flipIndex provided, flip that face-down card
  if (flipIndex !== undefined) {
    const cell = player.grid[flipIndex];
    if (cell && !cell.faceUp) {
      cell.faceUp = true;
    }
  }

  state.updatedAt = Date.now();
  await finishTurn(state, gameRef);
}

async function finishTurn(state: GolfGameState, gameRef: any): Promise<void> {
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const player = state.players.find(p => p.playerId === currentId);
  
  if (player) {
    // Check if all cards face up
    const allUp = player.grid.every(c => c && c.faceUp);
    if (allUp) player.allFaceUp = true;

    // Check if this player just went out
    if (allUp && !state.knockerId && state.phase === 'playing') {
      state.knockerId = currentId;
      state.phase = 'final-turns';
      state.finalTurnPlayerIds = state.turnOrder.filter(id => id !== currentId);
    }
  }

  // In final-turns, remove current player from final turns list
  if (state.phase === 'final-turns') {
    state.finalTurnPlayerIds = state.finalTurnPlayerIds.filter(id => id !== currentId);
    
    if (state.finalTurnPlayerIds.length === 0) {
      // Round over - flip all remaining cards and score
      await endRound(state);
      await set(gameRef, state);
      return;
    }
  }

  // Advance to next player
  advancePlayer(state);
  await set(gameRef, state);
}

function advancePlayer(state: GolfGameState): void {
  if (state.phase === 'final-turns') {
    // Find next player who still needs a final turn
    for (let i = 0; i < state.turnOrder.length; i++) {
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
      if (state.finalTurnPlayerIds.includes(state.turnOrder[state.currentPlayerIndex])) {
        return;
      }
    }
  } else {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
  }
}

async function endRound(state: GolfGameState): Promise<void> {
  // Flip all remaining face-down cards
  for (const player of state.players) {
    for (const cell of player.grid) {
      if (cell) cell.faceUp = true;
    }
    player.allFaceUp = true;
    
    const score = calculateGridScore(player.grid, state.config.variant);
    player.roundScores.push(score);
    player.totalScore = player.roundScores.reduce((a, b) => a + b, 0);
  }

  if (state.currentRound + 1 >= state.config.totalRounds) {
    state.phase = 'game-over';
  } else {
    state.phase = 'round-end';
  }
}

/** Start next round */
export async function startNextRound(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/golf`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state || state.phase !== 'round-end') return;

  const gridSize = getGridSize(state.config.variant);
  let deck = shuffleDeck(createDeck());

  for (const player of state.players) {
    const grid: GolfCard[] = [];
    for (let i = 0; i < gridSize; i++) {
      grid.push({ card: deck.shift()!, faceUp: false });
    }
    player.grid = grid;
    player.allFaceUp = false;
  }

  const firstDiscard = deck.shift()!;
  const initialFlips: Record<string, number> = {};
  state.players.forEach(p => { initialFlips[p.playerId] = 2; });

  state.deck = deck;
  state.discardPile = [firstDiscard];
  state.currentRound += 1;
  state.currentPlayerIndex = 0;
  state.drawnCard = null;
  state.drawnFrom = null;
  state.knockerId = null;
  state.finalTurnPlayerIds = [];
  state.initialFlipsRemaining = initialFlips;
  state.phase = 'flip-initial';
  state.updatedAt = Date.now();

  await set(gameRef, state);
}

/** Replay entire game */
export async function replayGolf(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/golf`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state) return;

  await initializeGolf(lobbyCode, state.config);
}
