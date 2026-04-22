import * as Crypto from 'expo-crypto';

export function createId(prefix = 'local'): string {
  return `${prefix}_${Crypto.randomUUID()}`;
}
