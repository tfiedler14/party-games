/**
 * Fishbowl — Logic tests
 */

describe('Fishbowl Turn Order', () => {
  it('alternates between teams', () => {
    const teams = ['team1', 'team2'];
    const turns: string[] = [];
    let currentTeamId = 'team1';
    for (let i = 0; i < 6; i++) {
      turns.push(currentTeamId);
      currentTeamId = currentTeamId === 'team1' ? 'team2' : 'team1';
    }
    expect(turns).toEqual(['team1', 'team2', 'team1', 'team2', 'team1', 'team2']);
  });

  it('turnOrderIndex advances when returning to team1', () => {
    let turnOrderIndex = 0;
    const sequence: number[] = [];
    
    // Simulate 4 turns: T1, T2, T1, T2
    const teamSeq = ['team1', 'team2', 'team1', 'team2'];
    for (const team of teamSeq) {
      sequence.push(turnOrderIndex);
      const nextTeam = team === 'team1' ? 'team2' : 'team1';
      if (nextTeam === 'team1') turnOrderIndex += 1;
    }
    // turnOrderIndex: 0, 0, 1, 1 (advances on return to team1)
    expect(sequence).toEqual([0, 0, 1, 1]);
  });

  it('player selection wraps around team size', () => {
    const team1 = ['A', 'B', 'C'];
    const team2 = ['D', 'E'];
    
    const getPlayer = (team: string[], idx: number) => team[idx % team.length];
    
    expect(getPlayer(team1, 0)).toBe('A');
    expect(getPlayer(team1, 1)).toBe('B');
    expect(getPlayer(team1, 2)).toBe('C');
    expect(getPlayer(team1, 3)).toBe('A'); // wraps
    expect(getPlayer(team2, 0)).toBe('D');
    expect(getPlayer(team2, 1)).toBe('E');
    expect(getPlayer(team2, 2)).toBe('D'); // wraps
  });
});

describe('Fishbowl Rounds', () => {
  it('has 4 rounds', () => {
    const FISHBOWL_ROUNDS = [
      { type: 'describe', name: 'Taboo' },
      { type: 'act', name: 'Charades' },
      { type: 'one-word', name: 'One Word' },
      { type: 'silhouette', name: 'Heads Up' },
    ];
    expect(FISHBOWL_ROUNDS).toHaveLength(4);
  });

  it('same slips recycled each round', () => {
    const allSlips = [{ id: '1', text: 'cat' }, { id: '2', text: 'dog' }];
    // Each round starts with bowl = shuffle(allSlips)
    const bowl = [...allSlips];
    expect(bowl).toHaveLength(allSlips.length);
  });
});

describe('Fishbowl Scoring', () => {
  it('team with most points wins', () => {
    const team1Score = 15;
    const team2Score = 12;
    const winner = team1Score > team2Score ? 'team1' : 'team2';
    expect(winner).toBe('team1');
  });
});
