import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
export { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as schema from './schema';

const expoDb = openDatabaseSync('fitness.db');
export const db = drizzle(expoDb, { schema });
