import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { participantsCollection, tournamentStateDoc, turnsCollection } from "../lib/paths";
import type { Participant, TournamentState, Turn } from "../types";

export function ResultsView() {
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    return onSnapshot(tournamentStateDoc(), (snap) => {
      setTournament(snap.exists() ? (snap.data() as TournamentState) : null);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(query(turnsCollection(), orderBy("turnNumber")), (snap) => {
      setTurns(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Turn, "id">) })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(participantsCollection(), (snap) => {
      setParticipants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, "id">) })));
    });
  }, []);

  const participantName = (id: string) => participants.find((p) => p.id === id)?.name ?? "不明な参加者";

  return (
    <div className="panel results-view">
      <h2>投票結果(全ターン)</h2>
      {turns.length === 0 && <p>ターンが登録されていません。</p>}
      {turns.map((turn) => (
        <TurnResultCard
          key={turn.id}
          turn={turn}
          isCurrent={tournament?.currentTurnId === turn.id}
          participantName={participantName}
        />
      ))}
    </div>
  );
}

function TurnResultCard({
  turn,
  isCurrent,
  participantName,
}: {
  turn: Turn;
  isCurrent: boolean;
  participantName: (id: string) => string;
}) {
  const ids = turn.isRevote && turn.revoteCandidateIds.length ? turn.revoteCandidateIds : turn.participantIds;
  const votes = turn.isRevote ? turn.revoteVotes ?? {} : turn.votes;
  const bars = ids
    .map((id) => ({ id, name: participantName(id), count: votes[id] ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const maxVotes = Math.max(1, ...bars.map((b) => b.count));

  return (
    <div className={`turn-result-card${isCurrent ? " turn-result-card-current" : ""}`}>
      <h3>
        第{turn.turnNumber}ターン {turn.isFinal ? "(決勝)" : ""} {turn.isRevote ? "(決選投票)" : ""}
        <span className="status-badge">{turn.status}</span>
      </h3>
      <div className="viz-root bar-chart">
        {bars.map((bar) => (
          <div className="bar-row" key={bar.id}>
            <span className="bar-label">{bar.name}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(bar.count / maxVotes) * 100}%` }} />
            </div>
            <span className="bar-value">{bar.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
