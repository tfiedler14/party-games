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
  ShipCaptainCrewGameState,
  SCCPlayerState,
  SCCDie,
  ShipCaptainCrewConfig,
  Lobby,
} from '../types';

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function createFreshDice(): SCCDie[] {
  return Array.from({ length: 5 }, () => ({
    value: rollDie(),
    locked: false,
    lockedAs: null,
  }));
}

function normalizeState(state: any): ShipCaptainCrewGameState {
  if (!state) return state;
  const playersData = state.players || [];
  const players = (Array.isArray(playersData) ? playersData : Object.values(playersData)).map((p: any) => ({
    ...p,
    dice: Array.isArray(p.dice) ? p.dice : Object.values(p.dice || {}),
    roundScore: p.roundScore ?? null,
    cargo: p.cargo ?? null,
  }));
  const turnOrder = Array.isArray(state.turnOrder) ? state.turnOrder : Object.values(state.turnOrder || {});
  const chaseTurnsRemaining = Array.isArray(state.chaseTurnsRemaining) ? state.chaseTurnsRemaining : Object.values(state.chaseTurnsRemaining || {});
  return {
    ...state,
    players,
    turnOrder,
    chaseTurnsRemaining,
    highScore: state.highScore ?? null,
    highScorerId: state.highScorerId ?? null,
    loserId: state.loserId ?? null,
    loserName: state.loserName ?? null,
  };
}

/**
 * Initialize Ship Captain Crew game
 */
export async function initializeShipCaptainCrew(
  lobbyCode: string,
  config: ShipCaptainCrewConfig
): Promise<ShipCaptainCrewGameState> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  const lobbySnapshot = await get(lobbyRef);
  if (!lobbySnapshot.exists()) throw new Error('Lobby not found');
  const lobby = lobbySnapshot.val() as Lobby;

  const players: SCCPlayerState[] = lobby.players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    isHost: p.isHost,
    dice: createFreshDice(),
    rollsLeft: 3,
    hasShip: false,
    hasCaptain: false,
    hasCrew: false,
    cargo: null,
    roundScore: null,
    totalScore: 0,
    isBustThisRound: false,
  }));

  const turnOrder = players.map(p => p.playerId);

  const gameState: ShipCaptainCrewGameState = {
    lobbyCode,
    config,
    players,
    turnOrder,
    currentPlayerIndex: 0,
    currentRound: 0,
    highScore: null,
    highScorerId: null,
    chaseMode: false,
    chaseTurnsRemaining: [],
    phase: 'rolling',
    loserId: null,
    loserName: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  await set(ref(database, `games/${lobbyCode}/shipCaptainCrew`), gameState);
  await update(lobbyRef, { status: 'playing', gameType: 'ship-captain-crew' });
  return gameState;
}

/**
 * Subscribe to game state
 */
export function subscribeToShipCaptainCrew(
  lobbyCode: string,
  callback: (state: ShipCaptainCrewGameState | null) => void
): () => void {
  const gameRef = ref(database, `games/${lobbyCode}/shipCaptainCrew`);
  onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(normalizeState(snapshot.val()));
    } else {
      callback(null);
    }
  });
  return () => off(gameRef);
}

/**
 * Roll dice for the active player. Unlocked dice get re-rolled.
 */
export async function rollDice(
  lobbyCode: string,
  playerId: string
): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/shipCaptainCrew`);
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) throw new Error('Game not found');
  const state = normalizeState(snapshot.val());

  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== playerId) throw new Error('Not your turn');

  const player = state.players.find(p => p.playerId === playerId)!;
  if (player.rollsLeft <= 0) throw new Error('No rolls left');

  // Re-roll unlocked dice
  player.dice = player.dice.map(d => 
    d.locked ? d : { value: rollDie(), locked: false, lockedAs: null }
  );
  player.rollsLeft -= 1;

  // Auto-detect ship/captain/crew in order
  autoLockSCC(player);

  await update(gameRef, { players: state.players, updatedAt: Date.now() });
}

/**
 * Auto-lock 6 (ship), 5 (captain), 4 (crew) in order from unlocked dice
 */
function autoLockSCC(player: SCCPlayerState): void {
  // Try to lock ship (6) if not already
  if (!player.hasShip) {
    const idx = player.dice.findIndex(d => !d.locked && d.value === 6);
    if (idx !== -1) {
      player.dice[idx].locked = true;
      player.dice[idx].lockedAs = 'ship';
      player.hasShip = true;
    }
  }
  // Try to lock captain (5) if ship locked
  if (player.hasShip && !player.hasCaptain) {
    const idx = player.dice.findIndex(d => !d.locked && d.value === 5);
    if (idx !== -1) {
      player.dice[idx].locked = true;
      player.dice[idx].lockedAs = 'captain';
      player.hasCaptain = true;
    }
  }
  // Try to lock crew (4) if captain locked
  if (player.hasShip && player.hasCaptain && !player.hasCrew) {
    const idx = player.dice.findIndex(d => !d.locked && d.value === 4);
    if (idx !== -1) {
      player.dice[idx].locked = true;
      player.dice[idx].lockedAs = 'crew';
      player.hasCrew = true;
    }
  }
  // If all three locked, calculate cargo
  if (player.hasShip && player.hasCaptain && player.hasCrew) {
    const cargoDice = player.dice.filter(d => d.lockedAs === null || d.lockedAs === 'cargo');
    player.cargo = cargoDice.reduce((sum, d) => sum + d.value, 0);
  }
}

/**
 * Toggle lock on a cargo die (only allowed after ship+captain+crew are locked)
 */
export async function toggleDieLock(
  lobbyCode: string,
  playerId: string,
  dieIndex: number
): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/shipCaptainCrew`);
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) throw new Error('Game not found');
  const state = normalizeState(snapshot.val());

  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== playerId) throw new Error('Not your turn');

  const player = state.players.find(p => p.playerId === playerId)!;
  const die = player.dice[dieIndex];
  
  // Can't unlock ship/captain/crew
  if (die.lockedAs === 'ship' || die.lockedAs === 'captain' || die.lockedAs === 'crew') {
    return;
  }

  // Can only lock/unlock cargo dice after getting ship+captain+crew
  if (player.hasShip && player.hasCaptain && player.hasCrew) {
    die.locked = !die.locked;
    die.lockedAs = die.locked ? 'cargo' : null;
    // Recalculate cargo
    const cargoDice = player.dice.filter(d => d.lockedAs === null || d.lockedAs === 'cargo');
    player.cargo = cargoDice.reduce((sum, d) => sum + d.value, 0);
  }

  await update(gameRef, { players: state.players, updatedAt: Date.now() });
}

/**
 * End the current player's turn (confirm score or bust)
 */
export async function endTurn(
  lobbyCode: string,
  playerId: string
): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/shipCaptainCrew`);
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) throw new Error('Game not found');
  const state = normalizeState(snapshot.val());

  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== playerId) throw new Error('Not your turn');

  const player = state.players.find(p => p.playerId === playerId)!;
  
  // Record score
  if (player.hasShip && player.hasCaptain && player.hasCrew && player.cargo !== null) {
    player.roundScore = player.cargo;
    player.isBustThisRound = false;

    // Check if this is a new high score
    if (state.highScore === null || player.cargo > state.highScore) {
      state.highScore = player.cargo;
      state.highScorerId = playerId;
    }

    // Enter chase mode if not already
    if (!state.chaseMode) {
      state.chaseMode = true;
      // Everyone except this player gets one more turn
      state.chaseTurnsRemaining = state.turnOrder.filter(id => id !== playerId);
    }
  } else {
    player.roundScore = null;
    player.isBustThisRound = true;
  }

  // Determine next player
  if (state.chaseMode) {
    // Remove current player from chase turns
    state.chaseTurnsRemaining = state.chaseTurnsRemaining.filter(id => id !== playerId);
    
    if (state.chaseTurnsRemaining.length === 0) {
      // Chase is over - determine loser
      finishGame(state);
    } else {
      // Next chase player
      const nextId = state.chaseTurnsRemaining[0];
      state.currentPlayerIndex = state.turnOrder.indexOf(nextId);
      resetPlayerForTurn(state.players.find(p => p.playerId === nextId)!);
    }
  } else {
    // Normal round-robin
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.turnOrder.length;
    
    // Check if we've gone all the way around with no score
    if (state.currentPlayerIndex === 0) {
      state.currentRound += 1;
      if (state.currentRound >= state.config.maxRounds) {
        finishGame(state);
      } else {
        // Reset all players for new round
        state.players.forEach(p => {
          p.roundScore = null;
          p.isBustThisRound = false;
        });
      }
    }
    
    if (state.phase !== 'game-over') {
      resetPlayerForTurn(state.players.find(p => p.playerId === state.turnOrder[state.currentPlayerIndex])!);
    }
  }

  await set(gameRef, state);
}

function resetPlayerForTurn(player: SCCPlayerState): void {
  player.dice = createFreshDice();
  player.rollsLeft = 3;
  player.hasShip = false;
  player.hasCaptain = false;
  player.hasCrew = false;
  player.cargo = null;
  player.roundScore = null;
  player.isBustThisRound = false;
}

function finishGame(state: ShipCaptainCrewGameState): void {
  state.phase = 'game-over';
  
  // Find loser: lowest score or no score
  // Players who busted (no 6-5-4) are worst
  // Among scorers, lowest cargo loses
  const scorers = state.players.filter(p => p.roundScore !== null);
  const busters = state.players.filter(p => p.roundScore === null);
  
  let loser: SCCPlayerState;
  if (busters.length > 0) {
    // Pick random buster (or the one with worst overall)
    loser = busters[0];
  } else {
    // All scored - lowest cargo loses
    loser = scorers.reduce((worst, p) => 
      (p.roundScore! < worst.roundScore!) ? p : worst
    );
  }
  
  state.loserId = loser.playerId;
  state.loserName = loser.playerName;
}

/**
 * Replay the game
 */
export async function replayShipCaptainCrew(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}/shipCaptainCrew`);
  const snapshot = await get(gameRef);
  if (!snapshot.exists()) throw new Error('Game not found');
  const state = normalizeState(snapshot.val());

  const players: SCCPlayerState[] = state.players.map(p => ({
    playerId: p.playerId,
    playerName: p.playerName,
    isHost: p.isHost,
    dice: createFreshDice(),
    rollsLeft: 3,
    hasShip: false,
    hasCaptain: false,
    hasCrew: false,
    cargo: null,
    roundScore: null,
    totalScore: 0,
    isBustThisRound: false,
  }));

  const newState: ShipCaptainCrewGameState = {
    lobbyCode,
    config: state.config,
    players,
    turnOrder: [...state.turnOrder].sort(() => Math.random() - 0.5),
    currentPlayerIndex: 0,
    currentRound: 0,
    highScore: null,
    highScorerId: null,
    chaseMode: false,
    chaseTurnsRemaining: [],
    phase: 'rolling',
    loserId: null,
    loserName: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  await set(gameRef, newState);
}
