export enum SessionStatus {
  OPEN = "OPEN",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface ShiftSession {
  id: string;
  userId: string;
  startOdometer: number;
  startedAt: string;
  endOdometer: number | null;
  endedAt: string | null;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}
