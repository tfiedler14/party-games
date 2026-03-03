import { ref, set, get, update, onValue, off } from 'firebase/database';
import { database } from './firebase';
import {
  FishbowlConfig,
  FishbowlGameState,
  FishbowlPlayer,
  FishbowlTeam,
  FishbowlTurn,
  FishbowlRoundType,
  Slip,
  Lobby,
  FISHBOWL_ROUNDS,
} from '../types';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Shuffle an array (Fisher-Yates)
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Normalize game state from Firebase (handle array/object conversions)
 */
function normalizeGameState(state: any): FishbowlGameState {
  return {
    ...state,
    players: Array.isArray(state.players) 
      ? state.players 
      : Object.values(state.players || {}),
    allSlips: Array.isArray(state.allSlips) 
      ? state.allSlips 
      : Object.values(state.allSlips || {}),
    bowl: Array.isArray(state.bowl) 
      ? state.bowl 
      : Object.values(state.bowl || {}),
    teams: {
      team1: {
        ...state.teams?.team1,
        playerIds: Array.isArray(state.teams?.team1?.playerIds)
          ? state.teams.team1.playerIds
          : Object.values(state.teams?.team1?.playerIds || {}),
      },
      team2: {
        ...state.teams?.team2,
        playerIds: Array.isArray(state.teams?.team2?.playerIds)
          ? state.teams.team2.playerIds
          : Object.values(state.teams?.team2?.playerIds || {}),
      },
    },
  };
}

/**
 * Initialize a new Fishbowl game
 */
export async function initializeFishbowl(
  lobbyCode: string,
  config: FishbowlConfig
): Promise<FishbowlGameState> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  const lobbySnapshot = await get(lobbyRef);

  if (!lobbySnapshot.exists()) {
    throw new Error('Lobby not found');
  }

  const lobby = lobbySnapshot.val() as Lobby;

  // Create players from lobby
  const players: FishbowlPlayer[] = lobby.players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    isHost: player.isHost,
    teamId: null,
    slipsSubmitted: 0,
    isReady: false,
  }));

  // Initialize empty teams
  const teams = {
    team1: {
      id: 'team1' as const,
      name: 'Team 1',
      playerIds: [],
      score: 0,
    },
    team2: {
      id: 'team2' as const,
      name: 'Team 2',
      playerIds: [],
      score: 0,
    },
  };

  const gameState: FishbowlGameState = {
    lobbyCode,
    config,
    players,
    teams,
    allSlips: [],
    bowl: [],
    currentRound: 0,
    roundType: 'describe',
    currentTurn: null,
    currentTeamId: 'team1',
    turnOrderIndex: 0,
    phase: 'setup',
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Save to Firebase
  await set(ref(database, `games/${lobbyCode}`), gameState);

  // Update lobby status
  await update(lobbyRef, { status: 'playing', gameType: 'fishbowl' });

  return gameState;
}

/**
 * Subscribe to game state updates
 */
export function subscribeToFishbowl(
  lobbyCode: string,
  callback: (gameState: FishbowlGameState | null) => void
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
 * Submit a slip (during setup phase)
 */
export async function submitSlip(
  lobbyCode: string,
  playerId: string,
  text: string
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

  if (player.slipsSubmitted >= gameState.config.slipsPerPlayer) {
    throw new Error('Already submitted maximum slips');
  }

  const slip: Slip = {
    id: generateId(),
    text: text.trim(),
    authorId: playerId,
    authorName: player.playerName,
  };

  gameState.allSlips.push(slip);
  player.slipsSubmitted += 1;

  await update(gameRef, {
    allSlips: gameState.allSlips,
    players: gameState.players,
    updatedAt: Date.now(),
  });
}

/**
 * Mark player as ready (done submitting slips)
 */
export async function setPlayerReady(
  lobbyCode: string,
  playerId: string,
  ready: boolean
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

  player.isReady = ready;

  // Check if all players are ready to move to team selection
  const allReady = gameState.players.every(p => p.isReady && p.slipsSubmitted > 0);

  await update(gameRef, {
    players: gameState.players,
    phase: allReady ? 'teams' : 'setup',
    updatedAt: Date.now(),
  });
}

/**
 * Assign a player to a team
 */
export async function assignToTeam(
  lobbyCode: string,
  playerId: string,
  teamId: 'team1' | 'team2'
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

  // Remove from old team if assigned
  if (player.teamId) {
    gameState.teams[player.teamId].playerIds = 
      gameState.teams[player.teamId].playerIds.filter(id => id !== playerId);
  }

  // Add to new team
  player.teamId = teamId;
  gameState.teams[teamId].playerIds.push(playerId);

  await update(gameRef, {
    players: gameState.players,
    teams: gameState.teams,
    updatedAt: Date.now(),
  });
}

/**
 * Auto-assign teams (shuffle and split evenly)
 */
export async function autoAssignTeams(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const shuffledPlayers = shuffle(gameState.players);

  // Clear existing assignments
  gameState.teams.team1.playerIds = [];
  gameState.teams.team2.playerIds = [];

  // Split evenly
  shuffledPlayers.forEach((player, index) => {
    const teamId = index % 2 === 0 ? 'team1' : 'team2';
    player.teamId = teamId;
    gameState.teams[teamId].playerIds.push(player.playerId);
  });

  await update(gameRef, {
    players: gameState.players,
    teams: gameState.teams,
    updatedAt: Date.now(),
  });
}

/**
 * Start the Fishbowl game (move from teams phase to playing)
 */
export async function startFishbowlGame(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());

  // Validate teams
  if (gameState.teams.team1.playerIds.length === 0 || 
      gameState.teams.team2.playerIds.length === 0) {
    throw new Error('Both teams must have at least one player');
  }

  // Fill the bowl with all slips
  gameState.bowl = shuffle([...gameState.allSlips]);
  gameState.phase = 'playing';
  gameState.currentRound = 0;
  gameState.roundType = FISHBOWL_ROUNDS[0].type;
  gameState.currentTeamId = 'team1';
  gameState.turnOrderIndex = 0;

  await update(gameRef, {
    bowl: gameState.bowl,
    phase: gameState.phase,
    currentRound: gameState.currentRound,
    roundType: gameState.roundType,
    currentTeamId: gameState.currentTeamId,
    turnOrderIndex: gameState.turnOrderIndex,
    updatedAt: Date.now(),
  });
}

/**
 * Start a turn for the current player
 */
export async function startTurn(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const currentTeam = gameState.teams[gameState.currentTeamId];
  const clueGiverId = currentTeam.playerIds[gameState.turnOrderIndex % currentTeam.playerIds.length];
  const clueGiver = gameState.players.find(p => p.playerId === clueGiverId);

  if (!clueGiver) {
    throw new Error('Clue giver not found');
  }

  // Draw first slip
  const bowl = [...gameState.bowl];
  const currentSlip = bowl.length > 0 ? bowl.pop()! : null;

  const turn: FishbowlTurn = {
    clueGiverId,
    clueGiverName: clueGiver.playerName,
    teamId: gameState.currentTeamId,
    currentSlip,
    slipsGuessedThisTurn: 0,
    startedAt: Date.now(),
    isPaused: false,
  };

  await update(gameRef, {
    bowl,
    currentTurn: turn,
    updatedAt: Date.now(),
  });
}

/**
 * Mark current slip as correctly guessed
 */
export async function correctGuess(lobbyCode: string): Promise<{ roundComplete: boolean }> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const turn = gameState.currentTurn;

  if (!turn || !turn.currentSlip) {
    throw new Error('No active turn or slip');
  }

  // Add point to team
  gameState.teams[turn.teamId].score += 1;
  turn.slipsGuessedThisTurn += 1;

  // Draw next slip
  const bowl = [...gameState.bowl];
  
  if (bowl.length > 0) {
    turn.currentSlip = bowl.pop()!;
    await update(gameRef, {
      bowl,
      currentTurn: turn,
      teams: gameState.teams,
      updatedAt: Date.now(),
    });
    return { roundComplete: false };
  } else {
    // Bowl is empty - round is complete
    turn.currentSlip = null;
    await update(gameRef, {
      bowl: [],
      currentTurn: turn,
      teams: gameState.teams,
      updatedAt: Date.now(),
    });
    return { roundComplete: true };
  }
}

/**
 * Skip current slip (put back in bowl)
 */
export async function skipSlip(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const turn = gameState.currentTurn;

  if (!turn || !turn.currentSlip) {
    throw new Error('No active turn or slip');
  }

  // Put current slip back in bowl (at random position)
  const bowl = [...gameState.bowl];
  const randomIndex = Math.floor(Math.random() * (bowl.length + 1));
  bowl.splice(randomIndex, 0, turn.currentSlip);

  // Draw new slip
  if (bowl.length > 1) {
    // Make sure we don't draw the same slip we just put back
    let newSlip = bowl.pop()!;
    if (newSlip.id === turn.currentSlip.id && bowl.length > 0) {
      bowl.unshift(newSlip);
      newSlip = bowl.pop()!;
    }
    turn.currentSlip = newSlip;
  }

  await update(gameRef, {
    bowl,
    currentTurn: turn,
    updatedAt: Date.now(),
  });
}

/**
 * End the current turn (timer ran out)
 */
export async function endTurn(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const turn = gameState.currentTurn;

  // Put current slip back in bowl if there was one
  const bowl = [...gameState.bowl];
  if (turn?.currentSlip) {
    bowl.push(turn.currentSlip);
  }

  // Switch teams
  const nextTeamId = gameState.currentTeamId === 'team1' ? 'team2' : 'team1';
  
  // If switching back to team1, advance turn order
  let nextTurnOrderIndex = gameState.turnOrderIndex;
  if (nextTeamId === 'team1') {
    nextTurnOrderIndex += 1;
  }

  await update(gameRef, {
    bowl: shuffle(bowl), // Shuffle bowl
    currentTurn: null,
    currentTeamId: nextTeamId,
    turnOrderIndex: nextTurnOrderIndex,
    updatedAt: Date.now(),
  });
}

/**
 * End the current round and start the next (or end game)
 */
export async function endRound(lobbyCode: string): Promise<{ gameOver: boolean }> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());
  const nextRound = gameState.currentRound + 1;

  if (nextRound >= FISHBOWL_ROUNDS.length) {
    // Game over!
    await update(gameRef, {
      phase: 'game-over',
      currentTurn: null,
      updatedAt: Date.now(),
    });
    return { gameOver: true };
  }

  // Refill bowl for next round
  const bowl = shuffle([...gameState.allSlips]);

  // Switch starting team for fairness
  const nextTeamId = gameState.currentRound % 2 === 0 ? 'team2' : 'team1';

  await update(gameRef, {
    bowl,
    currentRound: nextRound,
    roundType: FISHBOWL_ROUNDS[nextRound].type,
    currentTurn: null,
    currentTeamId: nextTeamId,
    turnOrderIndex: 0,
    phase: 'round-end',
    updatedAt: Date.now(),
  });

  return { gameOver: false };
}

/**
 * Continue to next round (after showing round-end screen)
 */
export async function continueToNextRound(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  
  await update(gameRef, {
    phase: 'playing',
    updatedAt: Date.now(),
  });
}

/**
 * Replay the game
 */
export async function replayFishbowl(lobbyCode: string): Promise<void> {
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(gameRef);

  if (!snapshot.exists()) {
    throw new Error('Game not found');
  }

  const gameState = normalizeGameState(snapshot.val());

  // Reset scores
  gameState.teams.team1.score = 0;
  gameState.teams.team2.score = 0;

  // Refill and shuffle bowl
  const bowl = shuffle([...gameState.allSlips]);

  await update(gameRef, {
    bowl,
    teams: gameState.teams,
    currentRound: 0,
    roundType: FISHBOWL_ROUNDS[0].type,
    currentTurn: null,
    currentTeamId: 'team1',
    turnOrderIndex: 0,
    phase: 'playing',
    updatedAt: Date.now(),
  });
}
