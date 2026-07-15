import { useEffect, useState } from "react";
import { onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { participantsCollection, turnDoc, turnsCollection } from "../lib/paths";
import type { Participant, Turn } from "../types";

interface TiedTurn {
  turn: Turn;
  tiedIds: string[];
}

export function RevoteControl() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const unsubTurns = onSnapshot(query(turnsCollection(), orderBy("turnNumber")), (snap) => {
      setTurns(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Turn, "id">) })));
    });
    const unsubParticipants = onSnapshot(participantsCollection(), (snap) => {
      setParticipants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, "id">) })));
    });
    return () => {
      unsubTurns();
      unsubParticipants();
    };
  }, []);

  const participantName = (id: string) => participants.find((p) => p.id === id)?.name ?? "不明な参加者";

  const tiedTurns: TiedTurn[] = turns
    .filter((t) => t.status === "closed" && !t.winnerId)
    .map((t) => {
      const votes = t.isRevote ? t.revoteVotes ?? {} : t.votes;
      const entries = Object.entries(votes);
      if (entries.length === 0) return null;
      const max = Math.max(...entries.map(([, v]) => v));
      const tiedIds = entries.filter(([, v]) => v === max).map(([id]) => id);
      return tiedIds.length > 1 ? { turn: t, tiedIds } : null;
    })
    .filter((x): x is TiedTurn => x !== null);

  const startRevote = async (turn: Turn, tiedIds: string[]) => {
    const revoteVotes: Record<string, number> = {};
    tiedIds.forEach((id) => (revoteVotes[id] = 0));
    await updateDoc(turnDoc(turn.id), {
      isRevote: true,
      revoteCandidateIds: tiedIds,
      revoteVotes,
      status: "accepting",
    });
  };

  return (
    <div className="panel">
      <h2>決選投票</h2>
      {tiedTurns.length === 0 && <p>現在、同数得票で決選投票が必要なターンはありません。</p>}
      {tiedTurns.map(({ turn, tiedIds }) => (
        <div key={turn.id} className="revote-item">
          <p style={{ margin: 0 }}>
            第{turn.turnNumber}ターンが同数得票です: {tiedIds.map(participantName).join(" / ")}
          </p>
          <button onClick={() => void startRevote(turn, tiedIds)}>決選投票を開始</button>
        </div>
      ))}
    </div>
  );
}
