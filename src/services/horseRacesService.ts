import { ref, set, get, onValue, off, update } from 'firebase/database';
import { database } from './firebase';
import {
  HorseRacesGameState,
  HorseRacesPlayer,
  HorseRacesConfig,
  HorseRacesCard,
  ScratchedHorse,
  Lobby,
} from '../types';

// Track lengths for each horse number
export const TRACK_LENGTHS: { [key: number]: number } = {
  2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 11, 9: 9, 10: 7, 11: 5, 12: 3,
};

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS: { [key: string]: string } = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

function createDeck(): HorseRacesCard[] {
  const deck: HorseRacesCard[] = [];
  for (const suit of SUITS) {
    for (let v = 2; v <= 12; v++) {
      const label = v <= 10 ? `${v}` : v === 11 ? 'J' : 'Q';
      deck.push({ suit, value: v, label: `${label}${SUIT_SYMBOLS[suit]}` });
    }
  }
  return deck;
}

function shuffleDeck(deck: HorseRacesCard[]): HorseRacesCard[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function rollTwoDice(): { die1: number; die2: number; sum: number } {
  const die1 = rollDie();
  const die2 = rollDie();
  return { die1, die2, sum: die1 + die2 };
}

function normalizeState(state: any): HorseRacesGameState {
  if (!state) return state;
  const playersData = state.players || [];
  const players = (Array.isArray(playersData) ? playersData : Object.values(playersData)).map((p: any) => ({
    ...p,
    hand: Array.isArray(p.hand) ? p.hand : Object.values(p.hand || {}),
  }));
  const turnOrder = Array.isArray(state.turnOrder) ? state.turnOrder : Object.values(state.turnOrder || {});
  const scratched = Array.isArray(state.scratched) ? state.scratched : Object.values(state.scratched || {});
  const winnerPlayerIds = Array.isArray(state.winnerPlayerIds) ? state.winnerPlayerIds : Object.values(state.winnerPlayerIds || {});
  
  // Normalize horsePositions - Firebase may store as array-like
  const hp: { [key: number]: number } = {};
  if (state.horsePositions) {
    for (const k of Object.keys(state.horsePositions)) {
      hp[Number(k)] = state.horsePositions[k] ?? 0;
    }
  }
  // Ensure all horses 2-12 exist
  for (let i = 2; i <= 12; i++) {
    if (hp[i] === undefined) hp[i] = 0;
  }
  
  return {
    ...state,
    players,
    turnOrder,
    scratched,
    winnerPlayerIds,
    horsePositions: hp,
    lastRoll: state.lastRoll || null,
    lastRollPenalty: state.lastRollPenalty ?? null,
    lastRollPlayerName: state.lastRollPlayerName ?? null,
    lastScratchRoll: state.lastScratchRoll ?? null,
    lastScratchWasDuplicate: state.lastScratchWasDuplicate ?? false,
    winningHorse: state.winningHorse ?? null,
    winnerPayout: state.winnerPayout ?? 0,
    pot: state.pot ?? 0,
  };
}

export async function initializeHorseRaces(lobbyCode: string, config: HorseRacesConfig): Promise<void> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  const lobbySnap = await get(lobbyRef);
  const lobby = lobbySnap.val() as Lobby;
  if (!lobby) throw new Error('Lobby not found');

  const playersList = Array.isArray(lobby.players) ? lobby.players : Object.values(lobby.players || {});
  
  // Create and shuffle deck (44 cards: 2-Q in 4 suits)
  let deck = shuffleDeck(createDeck());
  
  // Deal cards round-robin
  const hands: HorseRacesCard[][] = playersList.map(() => []);
  let pi = 0;
  for (const card of deck) {
    hands[pi % playersList.length].push(card);
    pi++;
  }
  
  const players: HorseRacesPlayer[] = playersList.map((p: any, i: number) => ({
    playerId: p.id,
    playerName: p.name,
    isHost: p.isHost,
    hand: hands[i],
    chips: config.startingChips,
  }));
  
  const turnOrder = players.map(p => p.playerId);
  
  const horsePositions: { [key: number]: number } = {};
  for (let i = 2; i <= 12; i++) horsePositions[i] = 0;
  
  const gameState: HorseRacesGameState = {
    lobbyCode,
    config,
    players,
    turnOrder,
    currentPlayerIndex: 0,
    phase: 'scratching',
    horsePositions,
    scratched: [],
    scratchRollCount: 0,
    lastScratchRoll: null,
    lastScratchWasDuplicate: false,
    pot: 0,
    lastRoll: null,
    lastRollPenalty: null,
    lastRollPlayerName: null,
    winningHorse: null,
    winnerPlayerIds: [],
    winnerPayout: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  await set(ref(database, `games/${lobbyCode}/horseRaces`), gameState);
  await update(lobbyRef, { status: 'playing', gameType: 'horse-races' });
}

export function subscribeToHorseRaces(lobbyCode: string, callback: (state: HorseRacesGameState) => void): () => void {
  const gameRef = ref(database, `games/${lobbyCode}/horseRaces`);
  const handler = onValue(gameRef, (snapshot) => {
    const state = snapshot.val();
    if (state) callback(normalizeState(state));
  });
  return () => off(gameRef, 'value', handler);
}

export async function rollScratchDice(lobbyCode: string, playerId: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/horseRaces`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state || state.phase !== 'scratching') return;
  
  // Only current player can roll
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== playerId) return;
  if (state.scratched.length >= 4) return;
  
  const roll = rollTwoDice();
  const scratchedNumbers = state.scratched.map(s => s.horseNumber);
  
  const updates: any = {
    lastScratchRoll: roll.sum,
    scratchRollCount: state.scratchRollCount + 1,
    updatedAt: Date.now(),
  };
  
  if (!scratchedNumbers.includes(roll.sum)) {
    // New scratch
    updates.lastScratchWasDuplicate = false;
    const newScratched: ScratchedHorse = {
      horseNumber: roll.sum,
      penaltyOrder: state.scratched.length + 1,
    };
    const allScratched = [...state.scratched, newScratched];
    updates.scratched = allScratched;
    
    // Remove cards matching scratched horse from all players' hands
    const updatedPlayers = state.players.map(p => ({
      ...p,
      hand: p.hand.filter(c => c.value !== roll.sum),
    }));
    updates.players = updatedPlayers;
    
    if (allScratched.length >= 4) {
      // Move to racing phase
      updates.phase = 'racing';
      updates.currentPlayerIndex = 0;
      updates.lastRoll = null;
    } else {
      // Next player rolls for scratch
      updates.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
    }
  } else {
    // Already scratched, re-roll needed - next player
    updates.lastScratchWasDuplicate = true;
    updates.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
  }
  
  await update(gameRef, updates);
}

export async function rollRaceDice(lobbyCode: string, playerId: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/horseRaces`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state || state.phase !== 'racing') return;
  
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== playerId) return;
  
  const roll = rollTwoDice();
  const scratched = state.scratched.find(s => s.horseNumber === roll.sum);
  
  const updates: any = {
    lastRoll: roll,
    updatedAt: Date.now(),
  };
  
  const currentPlayer = state.players.find(p => p.playerId === playerId)!;
  updates.lastRollPlayerName = currentPlayer.playerName;
  
  if (scratched) {
    // Penalty
    const penalty = scratched.penaltyOrder;
    updates.lastRollPenalty = penalty;
    updates.pot = state.pot + penalty;
    
    // Deduct from player's chips (floor at 0)
    const updatedPlayers = state.players.map(p => {
      if (p.playerId === playerId) {
        return { ...p, chips: Math.max(0, p.chips - penalty) };
      }
      return p;
    });
    updates.players = updatedPlayers;
  } else {
    updates.lastRollPenalty = null;
    
    // Move horse forward
    const newPos = (state.horsePositions[roll.sum] || 0) + 1;
    const hp = { ...state.horsePositions, [roll.sum]: newPos };
    updates.horsePositions = hp;
    
    // Check for winner
    if (newPos >= TRACK_LENGTHS[roll.sum]) {
      updates.phase = 'finished';
      updates.winningHorse = roll.sum;
      
      // Find players with cards matching winning horse
      const winners = state.players.filter(p => p.hand.some(c => c.value === roll.sum));
      const winnerIds = winners.map(p => p.playerId);
      updates.winnerPlayerIds = winnerIds.length > 0 ? winnerIds : ['_none_'];
      
      const payout = winnerIds.length > 0 ? Math.floor((state.pot) / winnerIds.length) : 0;
      updates.winnerPayout = payout;
      
      // Award chips to winners
      if (winnerIds.length > 0) {
        const updatedPlayers = state.players.map(p => {
          if (winnerIds.includes(p.playerId)) {
            return { ...p, chips: p.chips + payout };
          }
          return p;
        });
        updates.players = updatedPlayers;
      }
    }
  }
  
  // Next player
  updates.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
  
  await update(gameRef, updates);
}

export async function replayHorseRaces(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/horseRaces`);
  const snap = await get(gameRef);
  const state = normalizeState(snap.val());
  if (!state) return;
  
  // Re-initialize with same config and players
  await initializeHorseRaces(lobbyCode, state.config);
}
