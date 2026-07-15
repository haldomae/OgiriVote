import { useEffect, useRef, useState, type FormEvent } from "react";
import { addDoc, deleteDoc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import { participantDoc, participantsCollection } from "../lib/paths";
import type { Participant } from "../types";

async function uploadParticipantPhoto(participantId: string, file: File): Promise<string> {
  const photoRef = ref(storage, `participant-photos/${participantId}`);
  await uploadBytes(photoRef, file, { contentType: file.type });
  return getDownloadURL(photoRef);
}

export function ParticipantEditor() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const newPhotoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRefs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    const q = query(participantsCollection(), orderBy("order"));
    return onSnapshot(q, (snap) => {
      setParticipants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, "id">) })));
    });
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const nextOrder = participants.length ? Math.max(...participants.map((p) => p.order)) + 1 : 1;
    const docRef = await addDoc(participantsCollection(), { name, order: nextOrder, photoUrl: null });
    if (newPhoto) {
      setUploadingId(docRef.id);
      const photoUrl = await uploadParticipantPhoto(docRef.id, newPhoto);
      await updateDoc(participantDoc(docRef.id), { photoUrl });
      setUploadingId(null);
    }
    setNewName("");
    setNewPhoto(null);
    if (newPhotoInputRef.current) newPhotoInputRef.current.value = "";
  };

  const rename = (p: Participant) => {
    const name = window.prompt("参加者名を編集", p.name);
    if (name && name.trim() && name !== p.name) {
      void updateDoc(participantDoc(p.id), { name: name.trim() });
    }
  };

  const remove = (p: Participant) => {
    if (window.confirm(`${p.name} を削除しますか?`)) {
      void deleteDoc(participantDoc(p.id));
    }
  };

  const changePhoto = async (p: Participant, file: File) => {
    setUploadingId(p.id);
    const photoUrl = await uploadParticipantPhoto(p.id, file);
    await updateDoc(participantDoc(p.id), { photoUrl });
    setUploadingId(null);
  };

  return (
    <div className="panel">
      <h2>参加者管理</h2>
      <form onSubmit={handleAdd} className="inline-form participant-add-form">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="参加者名" />
        <input
          ref={newPhotoInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)}
        />
        <button type="submit">追加</button>
      </form>
      <ul className="participant-editor-list">
        {participants.map((p) => (
          <li key={p.id}>
            <span className="participant-info">
              {p.photoUrl ? (
                <img className="participant-thumb" src={p.photoUrl} alt={p.name} />
              ) : (
                <span className="participant-thumb participant-thumb-empty" />
              )}
              {p.name}
              {uploadingId === p.id && " (アップロード中...)"}
            </span>
            <span className="row-actions">
              <button className="secondary" onClick={() => rename(p)}>
                編集
              </button>
              <button
                className="secondary"
                onClick={() => editPhotoInputRefs.current.get(p.id)?.click()}
              >
                写真を変更
              </button>
              <input
                ref={(el) => {
                  if (el) editPhotoInputRefs.current.set(p.id, el);
                  else editPhotoInputRefs.current.delete(p.id);
                }}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void changePhoto(p, file);
                  e.target.value = "";
                }}
              />
              <button className="secondary" onClick={() => remove(p)}>
                削除
              </button>
            </span>
          </li>
        ))}
        {participants.length === 0 && <p>参加者が登録されていません。</p>}
      </ul>
    </div>
  );
}
