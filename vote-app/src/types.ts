export type TournamentStatus = "not_started" | "in_progress" | "finished";

export interface TournamentState {
  status: TournamentStatus;
  currentTurnId: string | null;
}

export type TurnStatus = "pending" | "accepting" | "closed";

export interface Turn {
  turnNumber: number;
  status: TurnStatus;
  isRevote: boolean;
  isFinal?: boolean;
  participantIds: string[];
  votes: Record<string, number>;
  revoteVotes?: Record<string, number>;
  revoteCandidateIds: string[];
  winnerId: string | null;
}

export interface Participant {
  name: string;
  eliminated: boolean;
  order: number;
  photoUrl: string | null;
}
