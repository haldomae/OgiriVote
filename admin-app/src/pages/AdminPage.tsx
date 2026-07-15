import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "../firebase";
import { TournamentControl } from "../components/TournamentControl";
import { ParticipantEditor } from "../components/ParticipantEditor";
import { TurnControl } from "../components/TurnControl";
import { RevoteControl } from "../components/RevoteControl";
import { ResultsView } from "../components/ResultsView";
import { SurveyEditor } from "../components/SurveyEditor";
import { SurveyResults } from "../components/SurveyResults";

export function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return <div className="page-center">読み込み中...</div>;
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>大喜利大会 管理画面</h1>
        <div className="admin-header-right">
          <span>{user.email}</span>
          <button className="secondary" onClick={() => void signOut(auth)}>
            ログアウト
          </button>
        </div>
      </header>

      <TournamentControl />

      <div className="admin-grid">
        <ParticipantEditor />
        <TurnControl />
      </div>

      <RevoteControl />
      <ResultsView />

      <div className="admin-grid">
        <SurveyEditor />
        <SurveyResults />
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-center">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 style={{ fontSize: 18, margin: 0 }}>管理者ログイン</h1>
        <label>
          メールアドレス
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          パスワード
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}
