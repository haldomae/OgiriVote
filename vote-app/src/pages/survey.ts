import { addDoc, collection, serverTimestamp, type Firestore } from "firebase/firestore";
import type { SurveyQuestion } from "../types";
import { renderMessage } from "./status";

const SURVEY_DONE_MESSAGE = "ご回答ありがとうございました。";

export function renderSurveyPage(
  root: HTMLElement,
  db: Firestore,
  questions: SurveyQuestion[],
  onSubmitted: () => void
): void {
  root.innerHTML = `
    <div class="vote-screen">
      <div class="survey-list">
        ${questions.map((q) => renderQuestionHtml(q)).join("")}
      </div>
      <div class="vote-footer">
        <div class="error-box" hidden></div>
        <button class="submit-vote-button" disabled>送信する</button>
      </div>
    </div>
  `;

  const submitButton = root.querySelector<HTMLButtonElement>(".submit-vote-button")!;
  const errorBox = root.querySelector<HTMLDivElement>(".error-box")!;
  const choiceSelections = new Map<string, string>();

  const isAllAnswered = () =>
    questions.every((q) => {
      if (q.type === "choice") return choiceSelections.has(q.id);
      const el = root.querySelector<HTMLTextAreaElement>(`.survey-text-input[data-question-id="${q.id}"]`);
      return !!el && el.value.trim() !== "";
    });

  const updateSubmitState = () => {
    submitButton.disabled = !isAllAnswered();
  };

  questions
    .filter((q) => q.type === "choice")
    .forEach((q) => {
      const tiles = root.querySelectorAll<HTMLButtonElement>(`.survey-choice[data-question-id="${q.id}"]`);
      tiles.forEach((tile) => {
        tile.addEventListener("click", () => {
          choiceSelections.set(q.id, tile.dataset.value ?? "");
          tiles.forEach((t) => t.classList.toggle("selected", t === tile));
          updateSubmitState();
        });
      });
    });

  root.querySelectorAll<HTMLTextAreaElement>(".survey-text-input").forEach((el) => {
    el.addEventListener("input", updateSubmitState);
  });

  const setInputsDisabled = (disabled: boolean) => {
    root.querySelectorAll<HTMLButtonElement>(".survey-choice").forEach((t) => (t.disabled = disabled));
    root.querySelectorAll<HTMLTextAreaElement>(".survey-text-input").forEach((t) => (t.disabled = disabled));
  };

  const submit = async () => {
    const answers: Record<string, string> = {};
    questions.forEach((q) => {
      if (q.type === "choice") {
        answers[q.id] = choiceSelections.get(q.id) ?? "";
      } else {
        const el = root.querySelector<HTMLTextAreaElement>(`.survey-text-input[data-question-id="${q.id}"]`);
        answers[q.id] = el?.value.trim() ?? "";
      }
    });

    setInputsDisabled(true);
    submitButton.disabled = true;
    errorBox.hidden = true;

    try {
      await addDoc(collection(db, "surveyResponses"), {
        submittedAt: serverTimestamp(),
        answers,
      });
      onSubmitted();
      renderMessage(root, SURVEY_DONE_MESSAGE);
    } catch {
      setInputsDisabled(false);
      updateSubmitState();
      errorBox.hidden = false;
      errorBox.innerHTML = `
        送信に失敗しました。通信環境をご確認のうえ、もう一度お試しください。
        <br />
        <button class="retry-button">再送する</button>
      `;
      errorBox.querySelector<HTMLButtonElement>(".retry-button")!.onclick = () => void submit();
    }
  };

  submitButton.addEventListener("click", () => void submit());
}

function renderQuestionHtml(q: SurveyQuestion): string {
  const title = `<p class="survey-question-title">${escapeHtml(q.question)}</p>`;

  if (q.type === "choice") {
    const choices = (q.choices ?? [])
      .map(
        (choice) =>
          `<button type="button" class="survey-choice" data-question-id="${q.id}" data-value="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`
      )
      .join("");
    return `
      <div class="survey-question">
        ${title}
        <div class="survey-choice-grid">${choices}</div>
      </div>
    `;
  }

  return `
    <div class="survey-question">
      ${title}
      <textarea class="survey-text-input" data-question-id="${q.id}" rows="3" placeholder="ご自由にご記入ください"></textarea>
    </div>
  `;
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
