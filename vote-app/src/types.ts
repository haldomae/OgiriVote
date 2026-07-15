export type TournamentStatus = "not_started" | "in_progress" | "finished";

export interface TournamentState {
  status: TournamentStatus;
  currentTurnId: string | null;
  surveyOpen?: boolean;
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
  order: number;
  photoUrl: string | null;
}

export type SurveyQuestionType = "choice" | "text";

export interface SurveyQuestion {
  id: string;
  order: number;
  type: SurveyQuestionType;
  question: string;
  choices?: string[];
}
