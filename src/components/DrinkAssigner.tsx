import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { IrishPokerPlayer } from '../types';

interface DrinkAssignerProps {
  visible: boolean;
  drinksToAssign: number;
  players: IrishPokerPlayer[];
  currentPlayerId: string;
  onAssign: (toPlayerId: string, amount: number) => void;
  onClose: () => void;
}

export function DrinkAssigner({
  visible,
  drinksToAssign,
  players,
  currentPlayerId,
  onAssign,
  onClose,
}: DrinkAssignerProps) {
  const otherPlayers = players.filter(p => p.playerId !== currentPlayerId);
  const [remaining, setRemaining] = React.useState(drinksToAssign);
  const [assignments, setAssignments] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    setRemaining(drinksToAssign);
    setAssignments({});
  }, [drinksToAssign, visible]);

  const handleAssign = (playerId: string, amount: number) => {
    if (remaining < amount) return;
    
    setAssignments(prev => ({
      ...prev,
      [playerId]: (prev[playerId] || 0) + amount,
    }));
    setRemaining(prev => prev - amount);
  };

  const handleConfirm = () => {
    Object.entries(assignments).forEach(([playerId, amount]) => {
      if (amount > 0) {
        onAssign(playerId, amount);
      }
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>🎉 Assign Drinks!</Text>
          <Text style={styles.subtitle}>
            You have <Text style={styles.highlight}>{remaining}</Text> drinks to give out
          </Text>

          <View style={styles.playerList}>
            {otherPlayers.map(player => (
              <View key={player.playerId} style={styles.playerRow}>
                <Text style={styles.playerName}>{player.playerName}</Text>
                <View style={styles.assignControls}>
                  <Text style={styles.assignedCount}>
                    {assignments[player.playerId] || 0}
                  </Text>
                  <Pressable
                    style={[styles.assignButton, remaining === 0 && styles.disabledButton]}
                    onPress={() => handleAssign(player.playerId, 1)}
                    disabled={remaining === 0}
                  >
                    <Text style={styles.assignButtonText}>+1</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.assignButton, remaining < 2 && styles.disabledButton]}
                    onPress={() => handleAssign(player.playerId, 2)}
                    disabled={remaining < 2}
                  >
                    <Text style={styles.assignButtonText}>+2</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.confirmButton, remaining > 0 && styles.confirmDisabled]}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>
              {remaining > 0 ? `${remaining} left to assign` : 'Done!'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 350,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8b8b9e',
    textAlign: 'center',
    marginBottom: 24,
  },
  highlight: {
    color: '#e94560',
    fontWeight: 'bold',
  },
  playerList: {
    marginBottom: 20,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  playerName: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },
  assignControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignedCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e94560',
    marginRight: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  assignButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  assignButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#4a4a6a',
  },
  confirmButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmDisabled: {
    backgroundColor: '#4a4a6a',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});
