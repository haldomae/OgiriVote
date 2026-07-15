import { useEffect, useState, type FormEvent } from "react";
import { addDoc, deleteDoc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { surveyQuestionDoc, surveyQuestionsCollection } from "../lib/paths";
import type { SurveyQuestion, SurveyQuestionType } from "../types";

const parseChoices = (text: string) =>
  text
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);

export function SurveyEditor() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [type, setType] = useState<SurveyQuestionType>("choice");
  const [questionText, setQuestionText] = useState("");
  const [choicesText, setChoicesText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<SurveyQuestionType>("choice");
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editChoicesText, setEditChoicesText] = useState("");

  useEffect(() => {
    return onSnapshot(query(surveyQuestionsCollection(), orderBy("order")), (snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SurveyQuestion, "id">) })));
    });
  }, []);

  const nextOrder = questions.length ? Math.max(...questions.map((q) => q.order)) + 1 : 1;

  const addQuestion = async (e: FormEvent) => {
    e.preventDefault();
    const question = questionText.trim();
    if (!question) return;
    if (type === "choice" && parseChoices(choicesText).length < 2) {
      window.alert("選択肢を2つ以上入力してください。");
      return;
    }
    await addDoc(surveyQuestionsCollection(), {
      order: nextOrder,
      type,
      question,
      choices: type === "choice" ? parseChoices(choicesText) : [],
    });
    setQuestionText("");
    setChoicesText("");
  };

  const removeQuestion = (q: SurveyQuestion) => {
    if (window.confirm(`「${q.question}」を削除しますか?`)) {
      void deleteDoc(surveyQuestionDoc(q.id));
    }
  };

  const startEdit = (q: SurveyQuestion) => {
    setEditingId(q.id);
    setEditType(q.type);
    setEditQuestionText(q.question);
    setEditChoicesText((q.choices ?? []).join("\n"));
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (q: SurveyQuestion) => {
    const question = editQuestionText.trim();
    if (!question) return;
    if (editType === "choice" && parseChoices(editChoicesText).length < 2) {
      window.alert("選択肢を2つ以上入力してください。");
      return;
    }
    await updateDoc(surveyQuestionDoc(q.id), {
      type: editType,
      question,
      choices: editType === "choice" ? parseChoices(editChoicesText) : [],
    });
    setEditingId(null);
  };

  return (
    <div className="panel">
      <h2>アンケート設問管理</h2>

      <form onSubmit={addQuestion} className="turn-create-form">
        <label>
          種類{" "}
          <select value={type} onChange={(e) => setType(e.target.value as SurveyQuestionType)}>
            <option value="choice">選択肢</option>
            <option value="text">記入欄</option>
          </select>
        </label>
        <input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="設問文" />
        {type === "choice" && (
          <textarea
            value={choicesText}
            onChange={(e) => setChoicesText(e.target.value)}
            placeholder="選択肢(1行に1つ、2つ以上)"
          />
        )}
        <button type="submit">設問を追加</button>
      </form>

      <ul className="turn-list">
        {questions.map((q) => (
          <li key={q.id}>
            {editingId === q.id ? (
              <div className="turn-edit-form">
                <label>
                  種類{" "}
                  <select value={editType} onChange={(e) => setEditType(e.target.value as SurveyQuestionType)}>
                    <option value="choice">選択肢</option>
                    <option value="text">記入欄</option>
                  </select>
                </label>
                <input value={editQuestionText} onChange={(e) => setEditQuestionText(e.target.value)} placeholder="設問文" />
                {editType === "choice" && (
                  <textarea
                    value={editChoicesText}
                    onChange={(e) => setEditChoicesText(e.target.value)}
                    placeholder="選択肢(1行に1つ、2つ以上)"
                  />
                )}
                <div className="row-actions">
                  <button onClick={() => void saveEdit(q)}>保存</button>
                  <button className="secondary" onClick={cancelEdit}>
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="turn-list-header">
                  <strong>{q.question}</strong>
                  <span className="status-badge">{q.type === "choice" ? "選択肢" : "記入欄"}</span>
                </div>
                {q.type === "choice" && (
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{(q.choices ?? []).join(" / ")}</p>
                )}
                <div className="row-actions">
                  <button className="secondary" onClick={() => startEdit(q)}>
                    編集
                  </button>
                  <button className="secondary" onClick={() => removeQuestion(q)}>
                    削除
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
        {questions.length === 0 && <p>設問が登録されていません。</p>}
      </ul>
    </div>
  );
}
