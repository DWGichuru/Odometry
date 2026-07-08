export enum Platform {
  UBER = "UBER",
  LYFT = "LYFT",
  DOORDASH = "DOORDASH",
}

export enum EntrySource {
  MANUAL = "MANUAL",
  SCREENSHOT = "SCREENSHOT",
}

export interface Shift {
  id: string;
  userId: string;
  date: string; // ISO date string
  platform: Platform;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  amountEarned: number;
  tripsCompleted: number;
  startOdometer: number;
  endOdometer: number;
  distanceKm: number;
  entrySource: EntrySource;
  createdAt: string;
  updatedAt: string;
}
