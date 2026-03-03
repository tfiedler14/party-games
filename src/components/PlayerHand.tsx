import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PlayingCard } from './PlayingCard';
import { IrishPokerPlayer } from '../types';

interface PlayerHandProps {
  player: IrishPokerPlayer;
  currentRound: number;
  isCurrentTurn: boolean;
  isYou: boolean;
  compact?: boolean;
}

export function PlayerHand({ 
  player, 
  currentRound, 
  isCurrentTurn, 
  isYou,
  compact = false,
}: PlayerHandProps) {
  const cardSize = compact ? 'small' : 'medium';
  
  // Safely access hand data (Firebase may return undefined for null array values)
  const results = player.hand?.results || [null, null, null, null];
  const visibleCards = player.hand?.visibleCards || [null, null, null, null];
  
  // Cards are revealed if the round has been played (result is not null)
  const getRevealed = (index: number) => {
    return results[index] !== null && results[index] !== undefined;
  };

  // Get result icon
  const getResultIcon = (index: number) => {
    const result = results[index];
    if (result === null || result === undefined) return null;
    return result ? '✓' : '✗';
  };

  const drinksOwed = (player.drinks?.assigned || 0) - (player.drinks?.consumed || 0);

  return (
    <View style={[
      styles.container,
      isCurrentTurn && styles.currentTurn,
      isYou && styles.youContainer,
    ]}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Text style={[styles.playerName, isYou && styles.youName]}>
            {player.playerName}
            {isYou && ' (You)'}
          </Text>
          {isCurrentTurn && (
            <View style={styles.turnBadge}>
              <Text style={styles.turnBadgeText}>TURN</Text>
            </View>
          )}
        </View>
        {!compact && (
          <View style={styles.drinkInfo}>
            <Text style={styles.drinkText}>
              🍺 {drinksOwed > 0 ? `${drinksOwed} due` : 'caught up'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardsRow}>
        {visibleCards.map((card, index) => (
          <View key={index} style={styles.cardWrapper}>
            <PlayingCard
              card={card}
              revealed={getRevealed(index)}
              size={cardSize}
              highlight={isCurrentTurn && index === currentRound}
            />
            {getRevealed(index) && (
              <Text style={[
                styles.resultIcon,
                results[index] ? styles.correctIcon : styles.wrongIcon,
              ]}>
                {getResultIcon(index)}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  currentTurn: {
    borderColor: '#e94560',
    backgroundColor: '#1a1a3e',
  },
  youContainer: {
    backgroundColor: '#1a2a4e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  youName: {
    color: '#4ade80',
  },
  turnBadge: {
    backgroundColor: '#e94560',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  turnBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  drinkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drinkText: {
    fontSize: 13,
    color: '#8b8b9e',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  cardWrapper: {
    marginRight: 8,
    position: 'relative',
  },
  resultIcon: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 12,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  correctIcon: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
  },
  wrongIcon: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
  },
});
