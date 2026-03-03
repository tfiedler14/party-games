import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RoundType, ROUND_NAMES, DRINK_AMOUNTS, SUIT_SYMBOLS, Suit } from '../utils/cards';

interface GuessButtonsProps {
  roundType: RoundType;
  roundIndex: number;
  onGuess: (guess: string) => void;
  disabled?: boolean;
}

export function GuessButtons({ roundType, roundIndex, onGuess, disabled = false }: GuessButtonsProps) {
  const wrongDrinks = DRINK_AMOUNTS.wrong[roundIndex];
  const rightDrinks = DRINK_AMOUNTS.right[roundIndex];

  const renderButtons = () => {
    switch (roundType) {
      case 'red-black':
        return (
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.guessButton, styles.redButton, disabled && styles.disabledButton]}
              onPress={() => onGuess('red')}
              disabled={disabled}
            >
              <Text style={styles.buttonEmoji}>♥♦</Text>
              <Text style={styles.buttonText}>Red</Text>
            </Pressable>
            <Pressable
              style={[styles.guessButton, styles.blackButton, disabled && styles.disabledButton]}
              onPress={() => onGuess('black')}
              disabled={disabled}
            >
              <Text style={styles.buttonEmoji}>♠♣</Text>
              <Text style={styles.buttonText}>Black</Text>
            </Pressable>
          </View>
        );

      case 'higher-lower':
        return (
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.guessButton, styles.higherButton, disabled && styles.disabledButton]}
              onPress={() => onGuess('higher')}
              disabled={disabled}
            >
              <Text style={styles.buttonEmoji}>📈</Text>
              <Text style={styles.buttonText}>Higher</Text>
            </Pressable>
            <Pressable
              style={[styles.guessButton, styles.lowerButton, disabled && styles.disabledButton]}
              onPress={() => onGuess('lower')}
              disabled={disabled}
            >
              <Text style={styles.buttonEmoji}>📉</Text>
              <Text style={styles.buttonText}>Lower</Text>
            </Pressable>
          </View>
        );

      case 'in-between':
        return (
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.guessButton, styles.betweenButton, disabled && styles.disabledButton]}
              onPress={() => onGuess('in-between')}
              disabled={disabled}
            >
              <Text style={styles.buttonEmoji}>↔️</Text>
              <Text style={styles.buttonText}>In-Between</Text>
            </Pressable>
            <Pressable
              style={[styles.guessButton, styles.outsideButton, disabled && styles.disabledButton]}
              onPress={() => onGuess('outside')}
              disabled={disabled}
            >
              <Text style={styles.buttonEmoji}>↕️</Text>
              <Text style={styles.buttonText}>Outside</Text>
            </Pressable>
          </View>
        );

      case 'suit':
        const suits: { suit: Suit; symbol: string; color: string }[] = [
          { suit: 'hearts', symbol: '♥', color: '#dc2626' },
          { suit: 'diamonds', symbol: '♦', color: '#dc2626' },
          { suit: 'clubs', symbol: '♣', color: '#1a1a2e' },
          { suit: 'spades', symbol: '♠', color: '#1a1a2e' },
        ];
        return (
          <View style={styles.suitGrid}>
            {suits.map(({ suit, symbol, color }) => (
              <Pressable
                key={suit}
                style={[styles.suitButton, disabled && styles.disabledButton]}
                onPress={() => onGuess(suit)}
                disabled={disabled}
              >
                <Text style={[styles.suitSymbol, { color }]}>{symbol}</Text>
              </Pressable>
            ))}
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.roundTitle}>{ROUND_NAMES[roundType]}</Text>
      <Text style={styles.stakes}>
        Wrong: drink {wrongDrinks} • Right: give {rightDrinks}
      </Text>
      {renderButtons()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#16213e',
    borderRadius: 16,
    marginTop: 12,
  },
  roundTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  stakes: {
    fontSize: 14,
    color: '#8b8b9e',
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  guessButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  redButton: {
    backgroundColor: '#dc2626',
  },
  blackButton: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#3a3a5e',
  },
  higherButton: {
    backgroundColor: '#22c55e',
  },
  lowerButton: {
    backgroundColor: '#ef4444',
  },
  betweenButton: {
    backgroundColor: '#8b5cf6',
  },
  outsideButton: {
    backgroundColor: '#f59e0b',
  },
  buttonEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  suitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  suitButton: {
    width: 70,
    height: 70,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 6,
  },
  suitSymbol: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
