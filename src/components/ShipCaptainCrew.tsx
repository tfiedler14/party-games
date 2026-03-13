import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { ShipCaptainCrewGameState, SCCDie, SCCPlayerState } from '../types';

// Conditionally import sensors/haptics (web-safe)
let Accelerometer: any = null;
let Haptics: any = null;
try {
  Accelerometer = require('expo-sensors').Accelerometer;
} catch {}
try {
  Haptics = require('expo-haptics');
} catch {}

interface ShipCaptainCrewProps {
  gameState: ShipCaptainCrewGameState;
  currentPlayerId: string;
  isHost: boolean;
  onRollDice: () => Promise<void>;
  onToggleDieLock: (dieIndex: number) => Promise<void>;
  onEndTurn: () => Promise<void>;
  onReplay: () => Promise<void>;
  onExit: () => void;
}

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const DIE_DOTS: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

function DieView({ die, index, isActive, onToggle }: { 
  die: SCCDie; index: number; isActive: boolean; onToggle: (i: number) => void 
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const isLockable = die.lockedAs === 'cargo' || die.lockedAs === null;
  const isSCC = die.lockedAs === 'ship' || die.lockedAs === 'captain' || die.lockedAs === 'crew';

  const handlePress = () => {
    if (!isActive || isSCC) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 50, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onToggle(index);
  };

  const bgColor = isSCC ? '#e94560' : die.locked ? '#2d6a4f' : '#16213e';
  const label = die.lockedAs === 'ship' ? '🚢' : die.lockedAs === 'captain' ? '👨‍✈️' : die.lockedAs === 'crew' ? '👷' : null;

  return (
    <Pressable onPress={handlePress} disabled={!isActive || isSCC}>
      <Animated.View style={[
        styles.die,
        { backgroundColor: bgColor, transform: [{ scale: scaleAnim }] },
        die.locked && !isSCC && styles.dieLocked,
      ]}>
        <Text style={styles.dieText}>{die.value}</Text>
        {label && <Text style={styles.dieLabel}>{label}</Text>}
        {die.locked && !isSCC && <Text style={styles.dieLockIcon}>🔒</Text>}
      </Animated.View>
    </Pressable>
  );
}

export function ShipCaptainCrew({
  gameState,
  currentPlayerId,
  isHost,
  onRollDice,
  onToggleDieLock,
  onEndTurn,
  onReplay,
  onExit,
}: ShipCaptainCrewProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [shakeDetected, setShakeDetected] = useState(false);
  const drinkAnim = useRef(new Animated.Value(0)).current;
  const lastShakeTime = useRef(0);

  const currentPlayingId = gameState.turnOrder[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayingId === currentPlayerId;
  const activePlayer = gameState.players.find(p => p.playerId === currentPlayingId);
  const myPlayer = gameState.players.find(p => p.playerId === currentPlayerId);

  // Shake detection
  useEffect(() => {
    if (!Accelerometer || Platform.OS === 'web') return;
    
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      
      // Shake threshold
      if (magnitude > 2.5 && isMyTurn && !isRolling && activePlayer && activePlayer.rollsLeft > 0 && now - lastShakeTime.current > 1000) {
        lastShakeTime.current = now;
        handleRoll();
      }
      
      // Flip detection (z-axis negative = upside down)
      if (z < -0.8 && isMyTurn && !isRolling && activePlayer && activePlayer.rollsLeft > 0 && now - lastShakeTime.current > 1000) {
        lastShakeTime.current = now;
        handleRoll();
      }
    });
    
    return () => sub.remove();
  }, [isMyTurn, isRolling, activePlayer?.rollsLeft]);

  const handleRoll = useCallback(async () => {
    if (isRolling) return;
    setIsRolling(true);
    try {
      if (Haptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      await onRollDice();
    } finally {
      setIsRolling(false);
    }
  }, [isRolling, onRollDice]);

  // "Take a drink" animation
  useEffect(() => {
    if (gameState.phase === 'game-over' && gameState.loserId === currentPlayerId) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(drinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(drinkAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
        { iterations: 3 }
      ).start();
      if (Haptics) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  }, [gameState.phase, gameState.loserId]);

  // GAME OVER
  if (gameState.phase === 'game-over') {
    const isLoser = gameState.loserId === currentPlayerId;
    const drinkScale = drinkAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
    
    return (
      <View style={styles.container}>
        <View style={styles.gameOverContainer}>
          {isLoser ? (
            <Animated.View style={[styles.drinkCard, { transform: [{ scale: drinkScale }] }]}>
              <Text style={styles.drinkEmoji}>🍺</Text>
              <Text style={styles.drinkText}>Take a Drink!</Text>
              <Text style={styles.drinkSubtext}>You had the lowest score</Text>
            </Animated.View>
          ) : (
            <View style={styles.winCard}>
              <Text style={styles.winEmoji}>🎉</Text>
              <Text style={styles.winText}>You're Safe!</Text>
              <Text style={styles.winSubtext}>{gameState.loserName} drinks!</Text>
            </View>
          )}

          {/* Leaderboard */}
          <View style={styles.leaderboard}>
            <Text style={styles.leaderboardTitle}>Results</Text>
            {[...gameState.players]
              .sort((a, b) => (b.roundScore ?? -1) - (a.roundScore ?? -1))
              .map((p, i) => (
                <View key={p.playerId} style={[
                  styles.leaderRow,
                  p.playerId === gameState.loserId && styles.leaderRowLoser,
                ]}>
                  <Text style={styles.leaderRank}>{i + 1}</Text>
                  <Text style={styles.leaderName}>
                    {p.playerName} {p.playerId === currentPlayerId ? '(You)' : ''}
                  </Text>
                  <Text style={[styles.leaderScore, p.roundScore === null && styles.leaderBust]}>
                    {p.roundScore !== null ? `Cargo: ${p.roundScore}` : 'Bust!'}
                  </Text>
                </View>
              ))}
          </View>

          <Pressable style={styles.replayBtn} onPress={onReplay}>
            <Text style={styles.replayBtnText}>🔄 Play Again</Text>
          </Pressable>
          <Pressable style={styles.exitBtn} onPress={onExit}>
            <Text style={styles.exitBtnText}>Exit</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ROLLING PHASE
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.roundText}>Round {gameState.currentRound + 1}</Text>
        <Text style={styles.turnText}>
          {isMyTurn ? "🎯 Your Turn!" : `${activePlayer?.playerName}'s turn`}
        </Text>
        {gameState.chaseMode && (
          <View style={styles.chaseBadge}>
            <Text style={styles.chaseText}>
              ⚡ Chase! Beat {gameState.highScore} to survive
            </Text>
          </View>
        )}
      </View>

      {/* Status bar: Ship Captain Crew indicator */}
      {activePlayer && (
        <View style={styles.sccStatus}>
          <View style={[styles.sccItem, activePlayer.hasShip && styles.sccItemActive]}>
            <Text style={styles.sccEmoji}>🚢</Text>
            <Text style={[styles.sccLabel, activePlayer.hasShip && styles.sccLabelActive]}>
              Ship{activePlayer.hasShip ? ' ✓' : ' (6)'}
            </Text>
          </View>
          <View style={[styles.sccItem, activePlayer.hasCaptain && styles.sccItemActive]}>
            <Text style={styles.sccEmoji}>👨‍✈️</Text>
            <Text style={[styles.sccLabel, activePlayer.hasCaptain && styles.sccLabelActive]}>
              Captain{activePlayer.hasCaptain ? ' ✓' : ' (5)'}
            </Text>
          </View>
          <View style={[styles.sccItem, activePlayer.hasCrew && styles.sccItemActive]}>
            <Text style={styles.sccEmoji}>👷</Text>
            <Text style={[styles.sccLabel, activePlayer.hasCrew && styles.sccLabelActive]}>
              Crew{activePlayer.hasCrew ? ' ✓' : ' (4)'}
            </Text>
          </View>
          {activePlayer.cargo !== null && (
            <View style={[styles.sccItem, styles.sccItemCargo]}>
              <Text style={styles.sccEmoji}>📦</Text>
              <Text style={styles.cargoScore}>{activePlayer.cargo}</Text>
            </View>
          )}
        </View>
      )}

      {/* Dice area */}
      {activePlayer && (
        <View style={styles.diceArea}>
          <View style={styles.diceRow}>
            {activePlayer.dice.map((die, i) => (
              <DieView
                key={i}
                die={die}
                index={i}
                isActive={isMyTurn && activePlayer.hasCrew}
                onToggle={(idx) => onToggleDieLock(idx)}
              />
            ))}
          </View>
          <Text style={styles.rollsLeft}>
            {activePlayer.rollsLeft} roll{activePlayer.rollsLeft !== 1 ? 's' : ''} left
          </Text>
        </View>
      )}

      {/* Action buttons */}
      {isMyTurn && (
        <View style={styles.actions}>
          {activePlayer && activePlayer.rollsLeft > 0 && (
            <Pressable
              style={[styles.rollBtn, isRolling && styles.btnDisabled]}
              onPress={handleRoll}
              disabled={isRolling}
            >
              <Text style={styles.rollBtnText}>
                {isRolling ? '🎲 Rolling...' : '🎲 Roll Dice'}
              </Text>
            </Pressable>
          )}
          
          {activePlayer && (activePlayer.rollsLeft === 0 || (activePlayer.rollsLeft < 3)) && (
            <Pressable style={styles.endTurnBtn} onPress={onEndTurn}>
              <Text style={styles.endTurnBtnText}>
                {activePlayer.hasCrew 
                  ? `✅ Keep Cargo (${activePlayer.cargo})` 
                  : '❌ End Turn (Bust)'}
              </Text>
            </Pressable>
          )}

          {Platform.OS !== 'web' && activePlayer && activePlayer.rollsLeft > 0 && (
            <Text style={styles.shakeHint}>📱 Shake phone or flip upside down to roll!</Text>
          )}
        </View>
      )}

      {/* Spectator: leaderboard */}
      <ScrollView style={styles.spectatorArea}>
        <Text style={styles.spectatorTitle}>Players</Text>
        {gameState.players.map(p => (
          <View key={p.playerId} style={[
            styles.playerRow,
            p.playerId === currentPlayingId && styles.playerRowActive,
            p.playerId === currentPlayerId && styles.playerRowYou,
          ]}>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>
                {p.playerId === currentPlayingId ? '▶ ' : '  '}
                {p.playerName}
                {p.playerId === currentPlayerId ? ' (You)' : ''}
              </Text>
            </View>
            <Text style={styles.playerScore}>
              {p.roundScore !== null ? `📦 ${p.roundScore}` : p.isBustThisRound ? '💀' : '—'}
            </Text>
          </View>
        ))}
        
        {gameState.highScore !== null && (
          <View style={styles.highScoreBar}>
            <Text style={styles.highScoreText}>
              🏆 High Score: {gameState.highScore} ({gameState.players.find(p => p.playerId === gameState.highScorerId)?.playerName})
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Exit */}
      <Pressable style={styles.exitSmall} onPress={onExit}>
        <Text style={styles.exitSmallText}>Exit Game</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: { padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  roundText: { fontSize: 14, color: '#8b8b9e', textTransform: 'uppercase', letterSpacing: 2 },
  turnText: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginTop: 4 },
  chaseBadge: { marginTop: 8, backgroundColor: '#e94560', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  chaseText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  
  sccStatus: { flexDirection: 'row', justifyContent: 'center', padding: 12, gap: 8 },
  sccItem: { alignItems: 'center', backgroundColor: '#16213e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, opacity: 0.5 },
  sccItemActive: { opacity: 1, backgroundColor: '#2d6a4f' },
  sccItemCargo: { opacity: 1, backgroundColor: '#e94560' },
  sccEmoji: { fontSize: 20 },
  sccLabel: { fontSize: 11, color: '#8b8b9e', marginTop: 2 },
  sccLabelActive: { color: '#fff', fontWeight: '600' },
  cargoScore: { fontSize: 18, fontWeight: 'bold', color: '#fff' },

  diceArea: { alignItems: 'center', paddingVertical: 20 },
  diceRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  die: {
    width: 60, height: 60, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#2a2a4a',
  },
  dieLocked: { borderColor: '#2d6a4f' },
  dieText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  dieLabel: { fontSize: 10, position: 'absolute', top: 2 },
  dieLockIcon: { fontSize: 10, position: 'absolute', bottom: 2 },
  rollsLeft: { marginTop: 12, fontSize: 14, color: '#8b8b9e' },

  actions: { padding: 16, gap: 10, alignItems: 'center' },
  rollBtn: { backgroundColor: '#e94560', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12 },
  rollBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  endTurnBtn: { backgroundColor: '#16213e', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a4a' },
  endTurnBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  shakeHint: { fontSize: 12, color: '#8b8b9e', marginTop: 4 },

  spectatorArea: { flex: 1, padding: 16 },
  spectatorTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 8 },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  playerRowActive: { backgroundColor: '#16213e' },
  playerRowYou: { borderLeftWidth: 3, borderLeftColor: '#e94560' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, color: '#fff' },
  playerScore: { fontSize: 14, color: '#8b8b9e' },

  highScoreBar: { marginTop: 12, padding: 10, backgroundColor: '#16213e', borderRadius: 8, alignItems: 'center' },
  highScoreText: { color: '#e94560', fontSize: 14, fontWeight: '600' },

  exitSmall: { padding: 12, alignItems: 'center' },
  exitSmallText: { color: '#8b8b9e', fontSize: 14 },

  // Game Over
  gameOverContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  drinkCard: { backgroundColor: '#e94560', borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 24, width: '100%', maxWidth: 300 },
  drinkEmoji: { fontSize: 64, marginBottom: 12 },
  drinkText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  drinkSubtext: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 8 },
  winCard: { backgroundColor: '#2d6a4f', borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 24, width: '100%', maxWidth: 300 },
  winEmoji: { fontSize: 48, marginBottom: 8 },
  winText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  winSubtext: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  
  leaderboard: { width: '100%', maxWidth: 300, marginBottom: 24 },
  leaderboardTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8, textAlign: 'center' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4, backgroundColor: '#16213e' },
  leaderRowLoser: { backgroundColor: '#3d1a2e' },
  leaderRank: { fontSize: 16, fontWeight: 'bold', color: '#8b8b9e', width: 24 },
  leaderName: { flex: 1, fontSize: 15, color: '#fff' },
  leaderScore: { fontSize: 14, color: '#2d6a4f', fontWeight: '600' },
  leaderBust: { color: '#e94560' },

  replayBtn: { backgroundColor: '#2d6a4f', paddingVertical: 16, paddingHorizontal: 40, borderRadius: 12, marginBottom: 12 },
  replayBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  exitBtn: { paddingVertical: 12 },
  exitBtnText: { color: '#8b8b9e', fontSize: 16 },
});
