import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, getCardDisplay, getCardColor } from '../utils/cards';

interface PlayingCardProps {
  card: Card | null;
  revealed: boolean;
  size?: 'small' | 'medium' | 'large';
  highlight?: boolean;
}

export function PlayingCard({ card, revealed, size = 'medium', highlight = false }: PlayingCardProps) {
  const sizeStyles = {
    small: { width: 45, height: 65, fontSize: 14, borderRadius: 6 },
    medium: { width: 60, height: 85, fontSize: 18, borderRadius: 8 },
    large: { width: 80, height: 110, fontSize: 24, borderRadius: 10 },
  };

  const s = sizeStyles[size];

  if (!revealed || !card) {
    // Face down card
    return (
      <View style={[
        styles.card,
        styles.faceDown,
        { width: s.width, height: s.height, borderRadius: s.borderRadius },
        highlight && styles.highlight,
      ]}>
        <Text style={[styles.faceDownText, { fontSize: s.fontSize }]}>?</Text>
      </View>
    );
  }

  // Face up card
  const color = getCardColor(card);
  const display = getCardDisplay(card);

  return (
    <View style={[
      styles.card,
      styles.faceUp,
      { width: s.width, height: s.height, borderRadius: s.borderRadius },
      highlight && styles.highlight,
    ]}>
      <Text style={[
        styles.cardText,
        { fontSize: s.fontSize },
        color === 'red' ? styles.redCard : styles.blackCard,
      ]}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2a4a',
  },
  faceDown: {
    backgroundColor: '#1a4a7a',
    borderColor: '#2a5a9a',
  },
  faceUp: {
    backgroundColor: '#ffffff',
  },
  faceDownText: {
    color: '#4a8aca',
    fontWeight: 'bold',
  },
  cardText: {
    fontWeight: 'bold',
  },
  redCard: {
    color: '#dc2626',
  },
  blackCard: {
    color: '#1a1a2e',
  },
  highlight: {
    borderColor: '#e94560',
    borderWidth: 3,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
});
