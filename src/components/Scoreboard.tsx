import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { IrishPokerPlayer } from '../types';

interface ScoreboardProps {
  players: IrishPokerPlayer[];
  currentPlayerId: string;
  onRecordDrink: (playerId: string) => void;
}

export function Scoreboard({ players, currentPlayerId, onRecordDrink }: ScoreboardProps) {
  // Sort by drinks assigned (descending)
  const sortedPlayers = [...players].sort((a, b) => b.drinks.assigned - a.drinks.assigned);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🍺 Scoreboard</Text>
      
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.nameColumn]}>Player</Text>
        <Text style={[styles.headerCell, styles.numberColumn]}>Assigned</Text>
        <Text style={[styles.headerCell, styles.numberColumn]}>Taken</Text>
        <Text style={[styles.headerCell, styles.numberColumn]}>Due</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {sortedPlayers.map((player) => {
          const due = player.drinks.assigned - player.drinks.consumed;
          const isYou = player.playerId === currentPlayerId;

          return (
            <View key={player.playerId} style={[styles.row, isYou && styles.youRow]}>
              <Text style={[styles.cell, styles.nameColumn, styles.nameText]} numberOfLines={1}>
                {player.playerName}
                {isYou && ' (You)'}
              </Text>
              <Text style={[styles.cell, styles.numberColumn, styles.numberText]}>
                {player.drinks.assigned}
              </Text>
              <Pressable
                style={[styles.cell, styles.numberColumn, styles.takenCell]}
                onPress={() => isYou && onRecordDrink(player.playerId)}
              >
                <Text style={styles.numberText}>{player.drinks.consumed}</Text>
                {isYou && <Text style={styles.plusButton}>+</Text>}
              </Pressable>
              <Text style={[
                styles.cell, 
                styles.numberColumn, 
                styles.numberText,
                due > 0 ? styles.duePositive : styles.dueZero,
              ]}>
                {due}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    maxHeight: 250,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
    paddingBottom: 8,
    marginBottom: 8,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b8b9e',
    textTransform: 'uppercase',
  },
  scrollView: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  youRow: {
    backgroundColor: '#1a2a4e',
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  cell: {
    justifyContent: 'center',
  },
  nameColumn: {
    flex: 2,
  },
  numberColumn: {
    flex: 1,
    alignItems: 'center',
  },
  nameText: {
    fontSize: 14,
    color: '#ffffff',
  },
  numberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  takenCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButton: {
    fontSize: 14,
    color: '#4ade80',
    marginLeft: 4,
    fontWeight: 'bold',
  },
  duePositive: {
    color: '#f59e0b',
  },
  dueZero: {
    color: '#22c55e',
  },
});
