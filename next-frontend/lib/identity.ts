import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';

const MACHINE_ID_COOKIE = 'aisubs-machine-id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 1; // 1 years in seconds

/**
 * Gets or creates a unique machine ID stored in cookies
 * @returns {string} The machine ID
 */
export function getMachineId(): string {
  const cookieStore = cookies();
  const storedId = cookieStore.get(MACHINE_ID_COOKIE)?.value;
  
  if (storedId) {
    return storedId;
  }
  
  // Generate a new ID if one doesn't exist
  const newId = uuidv4();
  
  // Set the cookie with the new ID
  // This must be called in a Server Action or Route Handler
  cookieStore.set({
    name: MACHINE_ID_COOKIE,
    value: newId,
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'strict'
  });
  
  return newId;
}