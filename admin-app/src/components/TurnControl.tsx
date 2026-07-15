import { useEffect, useState, type FormEvent } from "react";
import { addDoc, deleteDoc, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { participantsCollection, tournamentStateDoc, turnDoc, turnsCollection } from "../lib/paths";
import type { Participant, TournamentState, Turn } from "../types";

export function TurnControl() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTurnId, setEditingTurnId] = useState<string | null>(null);
  const [editSelectedIds, setEditSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const unsubTurns = onSnapshot(query(turnsCollection(), orderBy("turnNumber")), (snap) => {
      setTurns(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Turn, "id">) })));
    });
    const unsubParticipants = onSnapshot(query(participantsCollection(), orderBy("order")), (snap) => {
      setParticipants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, "id">) })));
    });
    const unsubTournament = onSnapshot(tournamentStateDoc(), (snap) => {
      setTournament(snap.exists() ? (snap.data() as TournamentState) : null);
    });
    return () => {
      unsubTurns();
      unsubParticipants();
      unsubTournament();
    };
  }, []);

  const nextTurnNumber = turns.length ? Math.max(...turns.map((t) => t.turnNumber)) + 1 : 1;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const createTurn = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedIds.length < 2) {
      window.alert("参加者を2名以上選択してください。");
      return;
    }
    const votes: Record<string, number> = {};
    selectedIds.forEach((id) => (votes[id] = 0));

    await addDoc(turnsCollection(), {
      turnNumber: nextTurnNumber,
      status: "pending",
      isRevote: false,
      isFinal: false,
      participantIds: selectedIds,
      votes,
      revoteVotes: {},
      revoteCandidateIds: [],
      winnerId: null,
    });

    setSelectedIds([]);
  };

  const createFinalTurn = async () => {
    const winnerIds = turns.filter((t) => !t.isFinal && t.winnerId).map((t) => t.winnerId as string);
    const uniqueWinnerIds = Array.from(new Set(winnerIds));
    if (uniqueWinnerIds.length < 2) {
      window.alert("勝者が確定しているターンが2つ以上必要です。");
      return;
    }
    if (turns.some((t) => t.isFinal)) {
      if (!window.confirm("決勝ターンは既に作成されています。新しく作り直しますか?")) return;
    }
    const votes: Record<string, number> = {};
    uniqueWinnerIds.forEach((id) => (votes[id] = 0));

    await addDoc(turnsCollection(), {
      turnNumber: nextTurnNumber,
      status: "pending",
      isRevote: false,
      isFinal: true,
      participantIds: uniqueWinnerIds,
      votes,
      revoteVotes: {},
      revoteCandidateIds: [],
      winnerId: null,
    });
  };

  const startAccepting = async (turn: Turn) => {
    const batch = writeBatch(db);
    batch.update(tournamentStateDoc(), { currentTurnId: turn.id });
    batch.update(turnDoc(turn.id), { status: "accepting" });
    await batch.commit();
  };

  const setTurnStatus = (turn: Turn, status: Turn["status"]) => updateDoc(turnDoc(turn.id), { status });

  const removeTurn = (turn: Turn) => {
    if (window.confirm(`第${turn.turnNumber}ターンを削除しますか?`)) {
      void deleteDoc(turnDoc(turn.id));
    }
  };

  const confirmWinner = async (turn: Turn) => {
    const votes = turn.isRevote ? turn.revoteVotes ?? {} : turn.votes;
    const entries = Object.entries(votes);
    if (entries.length === 0) return;
    const max = Math.max(...entries.map(([, v]) => v));
    const topIds = entries.filter(([, v]) => v === max).map(([id]) => id);
    if (topIds.length > 1) {
      window.alert("同数得票です。決選投票パネルから決選投票を開始してください。");
      return;
    }
    await updateDoc(turnDoc(turn.id), { winnerId: topIds[0] });
  };

  const startEdit = (turn: Turn) => {
    setEditingTurnId(turn.id);
    setEditSelectedIds(turn.participantIds);
  };

  const cancelEdit = () => setEditingTurnId(null);

  const toggleEditSelected = (id: string) => {
    setEditSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveEdit = async (turn: Turn) => {
    if (editSelectedIds.length < 2) {
      window.alert("参加者を2名以上選択してください。");
      return;
    }
    const votes: Record<string, number> = {};
    editSelectedIds.forEach((id) => (votes[id] = turn.votes[id] ?? 0));

    await updateDoc(turnDoc(turn.id), {
      participantIds: editSelectedIds,
      votes,
    });
    setEditingTurnId(null);
  };

  const participantName = (id: string) => participants.find((p) => p.id === id)?.name ?? "不明な参加者";

  return (
    <div className="panel">
      <h2>ターン(対戦表)管理</h2>

      <form onSubmit={createTurn} className="turn-create-form">
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>第{nextTurnNumber}ターンを作成</p>
        <div className="checkbox-grid">
          {participants.map((p) => (
            <label key={p.id}>
              <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelected(p.id)} />{" "}
              {p.name}
            </label>
          ))}
        </div>
        <button type="submit">ターンを作成</button>
      </form>

      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button onClick={() => void createFinalTurn()}>
          決勝ターンを作成(各ターンの勝者を自動集約)
        </button>
      </div>

      <ul className="turn-list">
        {turns.map((turn) => (
          <li key={turn.id} className={tournament?.currentTurnId === turn.id ? "current-turn" : ""}>
            <div className="turn-list-header">
              <strong>
                第{turn.turnNumber}ターン {turn.isFinal ? "(決勝)" : ""} {turn.isRevote ? "(決選投票)" : ""}
              </strong>
              <span className="status-badge">{turn.status}</span>
            </div>

            {editingTurnId === turn.id ? (
              <div className="turn-edit-form">
                <div className="checkbox-grid">
                  {participants.map((p) => (
                    <label key={p.id}>
                      <input
                        type="checkbox"
                        checked={editSelectedIds.includes(p.id)}
                        onChange={() => toggleEditSelected(p.id)}
                      />{" "}
                      {p.name}
                    </label>
                  ))}
                </div>
                <div className="row-actions">
                  <button onClick={() => void saveEdit(turn)}>保存</button>
                  <button className="secondary" onClick={cancelEdit}>
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {turn.participantIds.map(participantName).join(" / ")}
                </p>
                <div className="row-actions">
                  <button
                    onClick={() => void startAccepting(turn)}
                    disabled={tournament?.currentTurnId === turn.id && turn.status === "accepting"}
                  >
                    受付開始
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void setTurnStatus(turn, "closed")}
                    disabled={turn.status === "closed"}
                  >
                    受付終了
                  </button>
                  <button
                    className="secondary"
                    onClick={() => void confirmWinner(turn)}
                    disabled={turn.status !== "closed"}
                  >
                    勝者を確定
                  </button>
                  <button className="secondary" onClick={() => startEdit(turn)}>
                    編集
                  </button>
                  <button className="secondary" onClick={() => removeTurn(turn)}>
                    削除
                  </button>
                </div>
                {turn.winnerId && <p style={{ fontSize: 13 }}>勝者: {participantName(turn.winnerId)}</p>}
              </>
            )}
          </li>
        ))}
        {turns.length === 0 && <p>ターンが登録されていません。</p>}
      </ul>
    </div>
  );
}
