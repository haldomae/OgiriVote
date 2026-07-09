import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { tournamentStateDoc, turnsCollection } from "../lib/paths";
import type { TournamentState, Turn } from "../types";

export function TournamentControl() {
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);

  useEffect(() => {
    const unsubTournament = onSnapshot(tournamentStateDoc(), (snap) => {
      setTournament(snap.exists() ? (snap.data() as TournamentState) : null);
    });
    const unsubTurns = onSnapshot(query(turnsCollection(), orderBy("turnNumber")), (snap) => {
      setTurns(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Turn, "id">) })));
    });
    return () => {
      unsubTournament();
      unsubTurns();
    };
  }, []);

  const startTournament = async () => {
    const firstTurn = turns.find((t) => t.turnNumber === 1);
    await setDoc(tournamentStateDoc(), {
      status: "in_progress",
      currentTurnId: firstTurn?.id ?? null,
    });
  };

  const finishTournament = () => updateDoc(tournamentStateDoc(), { status: "finished", currentTurnId: null });

  return (
    <div className="panel">
      <h2>大会全体の制御</h2>
      <p>現在のステータス: {tournament?.status ?? "not_started"}</p>
      <div className="row-actions">
        <button onClick={() => void startTournament()} disabled={tournament?.status === "in_progress"}>
          大会開始
        </button>
        <button
          className="secondary"
          onClick={() => void finishTournament()}
          disabled={!tournament || tournament.status === "finished"}
        >
          大会終了
        </button>
      </div>
    </div>
  );
}
