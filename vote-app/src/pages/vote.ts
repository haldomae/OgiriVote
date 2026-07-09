import { doc, updateDoc, increment, type Firestore } from "firebase/firestore";
import type { Turn } from "../types";
import { renderCompletePage } from "./complete";

export interface ParticipantInfo {
  name: string;
  photoUrl: string | null;
}

export function renderVotePage(
  root: HTMLElement,
  db: Firestore,
  turnId: string,
  turn: Turn,
  participants: Map<string, ParticipantInfo>,
  onVoted: () => void
): void {
  const candidateIds =
    turn.isRevote && turn.revoteCandidateIds.length > 0
      ? turn.revoteCandidateIds
      : turn.participantIds;

  root.innerHTML = `
    <div class="vote-screen">
      <div class="participant-grid">
        ${candidateIds
          .map((id) => {
            const info = participants.get(id);
            const name = escapeHtml(info?.name ?? "(不明な参加者)");
            const photo = info?.photoUrl
              ? `<img class="participant-card-photo" src="${escapeHtml(info.photoUrl)}" alt="${name}" loading="lazy" />`
              : `<span class="participant-card-photo participant-card-photo-empty"></span>`;
            return `
              <button class="participant-card" data-id="${id}">
                ${photo}
                <span class="participant-card-name"><span class="participant-card-name-text">${name}</span></span>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="vote-footer">
        <div class="error-box" hidden></div>
        <button class="submit-vote-button" disabled>投票する</button>
      </div>
    </div>
  `;

  const cards = root.querySelectorAll<HTMLButtonElement>(".participant-card");
  const submitButton = root.querySelector<HTMLButtonElement>(".submit-vote-button")!;
  const errorBox = root.querySelector<HTMLDivElement>(".error-box")!;
  let selectedId: string | null = null;

  const selectCard = (id: string) => {
    selectedId = selectedId === id ? null : id;
    cards.forEach((card) => card.classList.toggle("selected", card.dataset.id === selectedId));
    submitButton.disabled = selectedId === null;
  };

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      if (id) selectCard(id);
    });
  });

  const submitVote = async () => {
    if (!selectedId) return;
    const participantId = selectedId;

    cards.forEach((c) => (c.disabled = true));
    submitButton.disabled = true;
    errorBox.hidden = true;

    const field = turn.isRevote ? "revoteVotes" : "votes";

    try {
      await updateDoc(doc(db, "turns", turnId), {
        [`${field}.${participantId}`]: increment(1),
      });
      onVoted();
      renderCompletePage(root);
    } catch {
      cards.forEach((c) => (c.disabled = false));
      submitButton.disabled = false;
      errorBox.hidden = false;
      errorBox.innerHTML = `
        投票の送信に失敗しました。通信環境をご確認のうえ、もう一度お試しください。
        <br />
        <button class="retry-button">再送する</button>
      `;
      errorBox.querySelector<HTMLButtonElement>(".retry-button")!.onclick = () => void submitVote();
    }
  };

  submitButton.addEventListener("click", () => void submitVote());
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
