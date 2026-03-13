import {
  ref,
  set,
  get,
  push,
  onValue,
  off,
  remove,
  update,
  serverTimestamp,
} from 'firebase/database';
import { database } from './firebase';
import { Lobby, Player, GameType } from '../types';
import { generateLobbyCode } from '../utils/lobby';

/**
 * Create a new lobby and return its code
 */
export async function createLobby(hostName: string): Promise<{ lobbyCode: string; playerId: string }> {
  const lobbyCode = generateLobbyCode();
  const playerId = push(ref(database, 'players')).key!;
  
  const host: Player = {
    id: playerId,
    name: hostName,
    isHost: true,
    joinedAt: Date.now(),
  };

  const lobby: Omit<Lobby, 'id'> = {
    code: lobbyCode,
    hostId: playerId,
    players: [host],
    gameType: null,
    gameConfig: null,
    status: 'waiting',
    createdAt: Date.now(),
  };

  // Store lobby by code for easy lookup
  await set(ref(database, `lobbies/${lobbyCode}`), lobby);
  
  return { lobbyCode, playerId };
}

/**
 * Join an existing lobby
 */
export async function joinLobby(
  lobbyCode: string,
  playerName: string
): Promise<{ success: boolean; playerId?: string; error?: string }> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  const snapshot = await get(lobbyRef);

  if (!snapshot.exists()) {
    return { success: false, error: 'Lobby not found' };
  }

  const lobby = snapshot.val() as Lobby;
  
  if (lobby.status !== 'waiting') {
    return { success: false, error: 'Game already in progress' };
  }

  const playerId = push(ref(database, 'players')).key!;
  
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    isHost: false,
    joinedAt: Date.now(),
  };

  const updatedPlayers = [...(lobby.players || []), newPlayer];
  await update(lobbyRef, { players: updatedPlayers });

  return { success: true, playerId };
}

/**
 * Subscribe to lobby updates
 */
export function subscribeLobby(
  lobbyCode: string,
  callback: (lobby: Lobby | null) => void
): () => void {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  
  const listener = onValue(lobbyRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as Lobby);
    } else {
      callback(null);
    }
  });

  // Return unsubscribe function
  return () => off(lobbyRef);
}

/**
 * Leave a lobby (remove player)
 */
export async function leaveLobby(
  lobbyCode: string,
  playerId: string
): Promise<void> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  const gameRef = ref(database, `games/${lobbyCode}`);
  const snapshot = await get(lobbyRef);

  if (!snapshot.exists()) return;

  const lobby = snapshot.val() as Lobby;
  const player = lobby.players?.find(p => p.id === playerId);
  const updatedPlayers = lobby.players?.filter(p => p.id !== playerId) || [];
  
  // If host leaves OR lobby would be empty, delete everything
  if (player?.isHost || updatedPlayers.length === 0) {
    console.log(`Cleaning up lobby ${lobbyCode} and associated game data`);
    await remove(gameRef); // Remove game data first
    await remove(lobbyRef); // Then remove lobby
    return;
  }

  // Otherwise, just remove the player
  await update(lobbyRef, { players: updatedPlayers });
}

/**
 * Clean up a game and its lobby (called when exiting a completed game)
 */
export async function cleanupGameAndLobby(lobbyCode: string): Promise<void> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  const gameRef = ref(database, `games/${lobbyCode}`);
  
  console.log(`Cleaning up game and lobby: ${lobbyCode}`);
  
  try {
    await remove(gameRef);
    await remove(lobbyRef);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

/**
 * Set the game type for the lobby (host only)
 */
export async function setGameType(
  lobbyCode: string,
  gameType: GameType
): Promise<void> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  await update(lobbyRef, { gameType });
}

/**
 * Start the game (host only)
 */
export async function startGame(lobbyCode: string): Promise<void> {
  const lobbyRef = ref(database, `lobbies/${lobbyCode}`);
  await update(lobbyRef, { status: 'playing' });
}

/**
 * Check if a lobby exists
 */
/**
 * Get all lobbies with metadata
 */
export async function getAllLobbies(): Promise<{ code: string; playerCount: number; status: string; createdAt: number }[]> {
  const lobbiesRef = ref(database, 'lobbies');
  const snapshot = await get(lobbiesRef);
  if (!snapshot.exists()) return [];
  
  const data = snapshot.val();
  return Object.entries(data).map(([code, lobby]: [string, any]) => ({
    code,
    playerCount: lobby.players ? Object.keys(lobby.players).length : 0,
    status: lobby.status || 'unknown',
    createdAt: lobby.createdAt || 0,
  }));
}

/**
 * Wipe all lobbies and their associated games
 */
export async function wipeAllLobbies(): Promise<number> {
  const lobbiesRef = ref(database, 'lobbies');
  const gamesRef = ref(database, 'games');
  const snapshot = await get(lobbiesRef);
  const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
  
  await remove(lobbiesRef);
  await remove(gamesRef);
  return count;
}

export async function lobbyExists(lobbyCode: string): Promise<boolean> {
  const snapshot = await get(ref(database, `lobbies/${lobbyCode}`));
  return snapshot.exists();
}
