import { useEffect, useState } from "react";
import { deleteDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { surveyQuestionsCollection, surveyResponseDoc, surveyResponsesCollection } from "../lib/paths";
import type { SurveyQuestion, SurveyResponse } from "../types";

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function SurveyResults() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);

  useEffect(() => {
    return onSnapshot(query(surveyQuestionsCollection(), orderBy("order")), (snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SurveyQuestion, "id">) })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(surveyResponsesCollection(), (snap) => {
      setResponses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SurveyResponse, "id">) })));
    });
  }, []);

  const exportCsv = () => {
    const header = ["回答日時", ...questions.map((q) => q.question)];
    const rows = responses.map((r) => [
      r.submittedAt ? r.submittedAt.toDate().toLocaleString("ja-JP") : "",
      ...questions.map((q) => r.answers[q.id] ?? ""),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetResults = async () => {
    if (!window.confirm(`アンケート結果を全件削除します(${responses.length}件)。よろしいですか?`)) return;
    await Promise.all(responses.map((r) => deleteDoc(surveyResponseDoc(r.id))));
  };

  return (
    <div className="panel">
      <h2>アンケート結果</h2>
      <p>回答数: {responses.length}件</p>
      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button onClick={exportCsv} disabled={responses.length === 0}>
          CSVエクスポート
        </button>
        <button className="secondary" onClick={() => void resetResults()} disabled={responses.length === 0}>
          結果をリセット
        </button>
      </div>

      {questions.length === 0 && <p>設問が登録されていません。</p>}
      {questions.map((q) => (
        <div key={q.id} className="turn-result-card">
          <h3>{q.question}</h3>
          {q.type === "choice" ? (
            <ChoiceTally question={q} responses={responses} />
          ) : (
            <TextAnswers question={q} responses={responses} />
          )}
        </div>
      ))}
    </div>
  );
}

function ChoiceTally({ question, responses }: { question: SurveyQuestion; responses: SurveyResponse[] }) {
  const counts = new Map<string, number>();
  (question.choices ?? []).forEach((c) => counts.set(c, 0));
  responses.forEach((r) => {
    const answer = r.answers[question.id];
    if (answer && counts.has(answer)) {
      counts.set(answer, (counts.get(answer) ?? 0) + 1);
    }
  });
  const bars = Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  const max = Math.max(1, ...bars.map((b) => b.count));

  return (
    <div className="viz-root bar-chart">
      {bars.map((b) => (
        <div className="bar-row" key={b.label}>
          <span className="bar-label">{b.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(b.count / max) * 100}%` }} />
          </div>
          <span className="bar-value">{b.count}</span>
        </div>
      ))}
    </div>
  );
}

function TextAnswers({ question, responses }: { question: SurveyQuestion; responses: SurveyResponse[] }) {
  const answers = responses.map((r) => r.answers[question.id]).filter((a): a is string => !!a && a.trim() !== "");

  if (answers.length === 0) {
    return <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>回答はまだありません。</p>;
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
      {answers.map((a, i) => (
        <li key={i}>{a}</li>
      ))}
    </ul>
  );
}
