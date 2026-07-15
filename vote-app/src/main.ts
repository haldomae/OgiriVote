import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Participant, SurveyQuestion, TournamentState, Turn } from "./types";
import { renderLoading, renderMessage } from "./pages/status";
import { renderCompletePage } from "./pages/complete";
import { renderVotePage, type ParticipantInfo } from "./pages/vote";
import { renderSurveyPage } from "./pages/survey";

const root = document.getElementById("app")!;
const NETWORK_ERROR_MESSAGE = "通信エラーが発生しました。ページを再読み込みしてください。";
const WAITING_MESSAGE = "まもなく投票が始まります。";
const NOT_STARTED_MESSAGE = "まもなく開始します。";
const FINISHED_MESSAGE = "大会は終了しました。ご参加ありがとうございました。";
const CLOSED_MESSAGE = "このターンの投票は終了しました。";
const SURVEY_DONE_MESSAGE = "ご回答ありがとうございました。";

let unsubscribeTurn: Unsubscribe | null = null;
let currentTurnId: string | null = null;
let lastTurnSignature: string | null = null;
let votedRoundKey: string | null = null;
let renderToken = 0;

// アンケート/待機/終了などターン以外の画面の重複再描画を防ぐための署名
let lastTerminalSignature: string | null = null;
let surveyDone = false;

function switchTurnListener(turnId: string | null): void {
  if (turnId === currentTurnId) return;
  unsubscribeTurn?.();
  currentTurnId = turnId;
  lastTurnSignature = null;

  if (!turnId) {
    unsubscribeTurn = null;
    return;
  }
  unsubscribeTurn = onSnapshot(
    doc(db, "turns", turnId),
    (snap) => void handleTurnSnapshot(turnId, snap.exists() ? (snap.data() as Turn) : null),
    () => renderMessage(root, NETWORK_ERROR_MESSAGE)
  );
}

async function handleTurnSnapshot(turnId: string, turn: Turn | null): Promise<void> {
  if (!turn) {
    lastTurnSignature = null;
    renderMessage(root, WAITING_MESSAGE);
    return;
  }

  const candidateIds =
    turn.isRevote && turn.revoteCandidateIds.length > 0 ? turn.revoteCandidateIds : turn.participantIds;

  // 得票数(votes/revoteVotes)だけが変化した更新では再描画しない(他の参加者の投票の度に
  // 画面がちらつくのを防ぐ)。状態・決選投票フラグ・対象者が変わった時だけ再描画する。
  const signature = JSON.stringify({ status: turn.status, isRevote: turn.isRevote, candidateIds });
  if (signature === lastTurnSignature) return;
  lastTurnSignature = signature;

  if (turn.status === "pending") {
    renderMessage(root, WAITING_MESSAGE);
    return;
  }
  if (turn.status === "closed") {
    renderMessage(root, CLOSED_MESSAGE);
    return;
  }

  const roundKey = `${turnId}:${turn.isRevote}`;
  if (votedRoundKey === roundKey) {
    renderCompletePage(root);
    return;
  }

  const token = ++renderToken;
  renderLoading(root);
  const participantInfo = await fetchParticipantInfo(candidateIds);
  if (token !== renderToken) return; // 表示中に新しい更新が来ていたら古い結果は捨てる

  if (participantInfo === "error") {
    renderMessage(root, NETWORK_ERROR_MESSAGE);
    return;
  }

  renderVotePage(root, db, turnId, turn, participantInfo, () => {
    votedRoundKey = roundKey;
  });
}

async function fetchParticipantInfo(ids: string[]): Promise<Map<string, ParticipantInfo> | "error"> {
  const info = new Map<string, ParticipantInfo>();
  try {
    await Promise.all(
      ids.map(async (id) => {
        const snap = await getDoc(doc(db, "participants", id));
        if (snap.exists()) {
          const p = snap.data() as Participant;
          info.set(id, { name: p.name, photoUrl: p.photoUrl });
        }
      })
    );
    return info;
  } catch {
    return "error";
  }
}

async function fetchSurveyQuestions(): Promise<SurveyQuestion[] | "error"> {
  try {
    const snap = await getDocs(query(collection(db, "surveyQuestions"), orderBy("order")));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SurveyQuestion, "id">) }));
  } catch {
    return "error";
  }
}

async function renderSurvey(): Promise<void> {
  const token = ++renderToken;
  renderLoading(root);
  const questions = await fetchSurveyQuestions();
  if (token !== renderToken) return;

  if (questions === "error") {
    renderMessage(root, NETWORK_ERROR_MESSAGE);
    return;
  }
  if (questions.length === 0) {
    renderMessage(root, FINISHED_MESSAGE);
    return;
  }
  renderSurveyPage(root, db, questions, () => {
    surveyDone = true;
  });
}

function handleTournamentSnapshot(tournament: TournamentState | null): void {
  if (tournament && tournament.status === "in_progress" && tournament.currentTurnId) {
    lastTerminalSignature = null;
    switchTurnListener(tournament.currentTurnId);
    return;
  }

  switchTurnListener(null);

  if (tournament && tournament.status === "finished" && tournament.surveyOpen) {
    if (surveyDone) {
      if (lastTerminalSignature === "survey-done") return;
      lastTerminalSignature = "survey-done";
      renderMessage(root, SURVEY_DONE_MESSAGE);
      return;
    }
    if (lastTerminalSignature === "survey") return;
    lastTerminalSignature = "survey";
    void renderSurvey();
    return;
  }

  const signature = tournament?.status === "finished" ? "finished" : "not_started";
  if (signature === lastTerminalSignature) return;
  lastTerminalSignature = signature;
  renderMessage(root, tournament?.status === "finished" ? FINISHED_MESSAGE : NOT_STARTED_MESSAGE);
}

function main(): void {
  renderLoading(root);
  onSnapshot(
    doc(db, "tournament", "state"),
    (snap) => handleTournamentSnapshot(snap.exists() ? (snap.data() as TournamentState) : null),
    () => renderMessage(root, NETWORK_ERROR_MESSAGE)
  );
}

main();
