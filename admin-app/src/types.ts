import type { Timestamp } from "firebase/firestore";

export type TournamentStatus = "not_started" | "in_progress" | "finished";

export interface TournamentState {
  status: TournamentStatus;
  currentTurnId: string | null;
  surveyOpen?: boolean;
}

export interface Participant {
  id: string;
  name: string;
  order: number;
  photoUrl: string | null;
}

export type TurnStatus = "pending" | "accepting" | "closed";

export interface Turn {
  id: string;
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

export type SurveyQuestionType = "choice" | "text";

export interface SurveyQuestion {
  id: string;
  order: number;
  type: SurveyQuestionType;
  question: string;
  choices?: string[];
}

export interface SurveyResponse {
  id: string;
  submittedAt: Timestamp | null;
  answers: Record<string, string>;
}
