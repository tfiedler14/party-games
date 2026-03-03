/**
 * Generate a random 5-character lobby code
 * Uses uppercase letters excluding confusing characters (O, I, L)
 */
export function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
