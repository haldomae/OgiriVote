# 大喜利大会 投票サイト 実装指示書

このドキュメントは Claude Code(ClaudeCord経由含む)がこのプロジェクトを実装する際に参照する仕様書です。プロジェクトルートに `CLAUDE.md` として配置してください。

要件の背景・議論の経緯は同フォルダの `大喜利大会投票サイト_要件定義書.md` を参照してください。本ドキュメントはその中の「実装可能な形」への落とし込みです。

---

## 1. プロジェクト概要

学内の大喜利大会で使用する、トーナメント形式の投票Webアプリケーション。

- 参加者(観客)はQRコードから投票ページにアクセスし、各ターンで1人の回答者に投票する
- 投票ページには回答者の顔写真が表示される。管理者が事前に参加者ごとの写真をアップロードしておく
- 管理者は管理画面から大会・各ターンの進行を制御し、結果をリアルタイムに閲覧する
- 投票ページはリロード不要で、管理者側の操作(ターン切り替え・受付開始/終了など)に追従して自動的に画面が切り替わる
- 当日は学内Wi-Fiの回線混雑が予想されるため、**投票の書き込みは引き続き軽量**に保つ(得票数そのものは投票ページで購読・表示しない。詳細は2章参照)

---

## 2. 技術スタック(確定)

| 項目 | 採用技術 |
|---|---|
| バックエンド | Firebase(Firestore, Firebase Authentication, Cloud Storage for Firebase, Hosting) |
| 投票ページ(参加者側) | Firestore SDK(フル、`firebase/firestore`)+ 軽量フロント実装 |
| 管理者ページ | React(Firestore フルSDK + Firebase Authentication + Cloud Storage) |
| ローカル開発環境 | Docker / Docker Compose(ローカルにNode.js/React環境を持たない前提。Firebase CLIもDocker化する) |
| ホスティング | Firebase Hosting |

### 技術選定の理由(実装時に前提として守ること)
- 投票ページは **大会/ターンの進行状況(`tournament/state`・現在のターンの `turns/{turnId}`)についてのみ** Firestore のリアルタイムリスナー(`onSnapshot`)を使用する。これはリロード無しで画面を自動的に切り替えるための購読であり、**得票数(`votes`/`revoteVotes`)自体を購読・表示することはしない**(得票状況の閲覧は管理者ページのみが行う)
- 投票の書き込みは従来通り一方向・軽量: 得票集計は個々の投票記録を保存せず、**参加者ごとの得票数カウンタをアトミックインクリメント(`increment(1)`)で加算する方式**とする。投票実行後は結果を問い合わせず「投票完了」の静的表示のみ行う
- 管理者ページは Firestore のリアルタイムリスナー(`onSnapshot`)を全面的に使用してよい
- 投票の多重投票・不正対策は実装しない(学内イベントのため対策不要という要件)
- 参加者の顔写真は Cloud Storage for Firebase に保存し、ダウンロードURLを `participants/{participantId}.photoUrl` に保持する。投票ページは通常の `<img src>` でこのURLを表示するのみで、Storage SDK自体は読み込まない
- 管理者操作(大会/参加者/ターンの管理、写真アップロード)は Firebase Authentication(メール/パスワード)でログインしたユーザーのみ許可する。管理者アカウントは Firebase Console で事前作成し、アプリ側にサインアップ機能は用意しない(7章のセキュリティルールと対応させること)

---

## 3. ディレクトリ構成(提案)

```
.
├── CLAUDE.md                      # 本ドキュメント
├── docker-compose.yml
├── firebase.json                  # Hosting/Firestore/Storage設定。必ずリポジトリルート直下に置く
│                                   # (hosting.public は firebase.json のあるディレクトリ配下しか参照できないため。
│                                   #  vote-app/admin-app と同階層でなければ ../ 参照になりデプロイ時にエラーになる)
├── .firebaserc                    # プロジェクトID・Hostingターゲット設定
├── firestore.rules
├── firestore.indexes.json
├── storage.rules                  # 参加者写真の読み書き権限
├── firebase/
│   └── Dockerfile                 # firebase-tools をDocker化(ローカルNode.js非依存でCLIを使うため。設定ファイル本体はここではなくルートにある)
├── vote-app/                      # 投票ページ(軽量実装、ただし進行状況はリアルタイム購読)
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.ts                # tournament/state・現在ターンの onSnapshot 購読と画面切り替え
│   │   ├── firebase.ts            # Firestore SDK(フル)初期化
│   │   └── pages/
│   │       ├── vote.ts            # 投票画面(参加者の写真を表示)
│   │       ├── complete.ts        # 投票完了画面
│   │       └── status.ts          # 待機/エラー等の静的メッセージ画面
│   └── index.html
├── admin-app/                     # 管理者ページ(React)
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── firebase.ts            # Firebase JS SDK(フル: Firestore/Auth/Storage)初期化
│   │   ├── components/
│   │   │   ├── TournamentControl.tsx   # 大会全体の開始・終了
│   │   │   ├── TurnControl.tsx         # ターン作成・編集・削除・受付開始/終了・勝者確定・決勝ターン自動作成
│   │   │   ├── ResultsView.tsx         # リアルタイム結果表示(投影用)
│   │   │   ├── ParticipantEditor.tsx   # 参加者の登録/編集/写真アップロード
│   │   │   └── RevoteControl.tsx       # 決選投票の開始操作
│   │   └── pages/
│   │       └── AdminPage.tsx           # 管理者ログイン(Firebase Authentication)込み
│   └── index.html
```

---

## 4. Docker環境構築

ローカル環境にNode.js/Reactを直接インストールしない前提で、以下の構成とする。

### 4.1 `docker-compose.yml`(要件)
- `vote-app` サービス: 投票ページの開発サーバ(ホットリロード対応)
- `admin-app` サービス: 管理者ページ(React)の開発サーバ(ホットリロード対応)
- 各サービスはNode.jsの公式イメージ(LTS)をベースにする
- ソースコードはボリュームマウントし、コンテナ内で `npm install` → `npm run dev` を実行する
- ポートは重複しないように割り当てる(例: vote-app → 5173, admin-app → 5174)

### 4.2 実装時の注意
- `node_modules` はホスト側に汚染させないよう、匿名ボリュームまたは名前付きボリュームで管理する
- Firebaseへの接続は開発時も本番プロジェクトに向ける想定(Firebase Local Emulator Suiteを使うかどうかは要検討・下記オープン事項参照)
- `docker compose up` のみでローカル開発が開始できる状態を目指す
- ローカルにNode.js/npmを直接インストールしない前提のため、Firebase CLI(`firebase-tools`)も `docker-compose.yml` に `firebase-cli` サービスとして追加し、`docker compose run --rm firebase-cli <コマンド>` で実行できるようにする。ログイン情報は名前付きボリュームで永続化する

---

## 5. Firestore データモデル(設計案)

### 5.1 コレクション構成

```
tournament/state              … 大会全体のステータス(単一ドキュメント)
participants/{participantId}  … 参加者マスタ
turns/{turnId}                … 各ターン(ラウンド)の情報・得票
```

### 5.2 `tournament/state`

```jsonc
{
  "status": "not_started" | "in_progress" | "finished",
  "currentTurnId": "turn_01" | null
}
```

### 5.3 `participants/{participantId}`

```jsonc
{
  "name": "参加者名",
  "eliminated": false,
  "order": 1,           // 対戦表登録時の並び順管理用
  "photoUrl": null       // Cloud Storage for Firebase のダウンロードURL(未アップロード時は null)
}
```

写真は Cloud Storage の `participant-photos/{participantId}` に保存し、アップロード後に `getDownloadURL()` の結果をこの `photoUrl` に書き込む(管理者操作のみ、storage.rules 参照)。

### 5.4 `turns/{turnId}`

```jsonc
{
  "turnNumber": 1,
  "status": "pending" | "accepting" | "closed",
  "isRevote": false,                     // 決選投票フェーズかどうか
  "isFinal": false,                      // 決勝ターンかどうか(6.2参照。任意フィールド、省略時 false 扱い)
  "participantIds": ["p1", "p2", "p3"],  // このターンの参加者(2〜10名以上)
  "votes": {                             // 参加者ごとの得票数(アトミックインクリメントで更新)
    "p1": 0,
    "p2": 0,
    "p3": 0
  },
  "revoteVotes": {},                     // 決選投票の得票数(5.6参照)
  "revoteCandidateIds": [],              // 同数得票時、決選投票の対象者のみ格納
  "winnerId": null                       // 確定後にセット
}
```

### 5.4.1 決勝ターンの自動作成

- 管理者ページに「決勝ターンを作成」操作を用意する
- 実行すると、`isFinal` が立っていない全ターンのうち `winnerId` が確定済みのものを集め、その `winnerId` の集合を `participantIds` として新しいターン(`isFinal: true`)を作成する
- 「勝者を次ターンの `participantIds` に手動で反映する」機能は廃止した。ターン間の勝ち上がりは決勝ターンの自動作成のみで行う(通常ターン同士を直接連結する運用が必要な場合は、管理者が手動でターンを作成し参加者を選択する)

### 5.4.2 「現在のターンにする」と「受付開始」の統合

- 当初「現在のターンにする」(`tournament/state.currentTurnId` の切り替え)と「受付開始」(`turns/{turnId}.status` を `accepting` にする)を別々の操作としていたが、運用上ボタンが分かれていると使いにくいため**「受付開始」ボタン1つに統合した**
- 「受付開始」を押すと、`writeBatch` 等でアトミックに次の2つを同時に行う: (1) `tournament/state.currentTurnId` を対象ターンのIDにする、(2) 対象ターンの `status` を `accepting` にする
- 「現在のターンにする」という単独の操作・ボタンは廃止した

### 5.5 投票時の書き込み(投票ページが実行する操作)

```ts
// 通常投票 / 決選投票 共通
updateDoc(doc(db, "turns", turnId), {
  [`votes.${participantId}`]: increment(1)
});
```

- クライアントは `tournament/state` と現在のターン(`turns/{currentTurnId}`)を `onSnapshot` で購読し、`status` の変化(`pending`→`accepting`→`closed`)や `currentTurnId` の切り替え、`isRevote`/`revoteCandidateIds` の変化に応じて画面を自動的に切り替える(リロード不要)
- 購読しているのは進行状況(`status`・`isRevote`・対象者の集合)のみで、`votes`/`revoteVotes` の値そのものの変化では再描画しない(他の参加者の投票のたびに画面がちらつくのを防ぐため)
- 投票実行後は結果を問い合わせず、「投票が完了しました」という静的画面を表示するのみ。同じターン・同じ決選投票ラウンドである間は、他者の投票による再描画が来ても完了画面を維持する(クライアント側で「投票済みラウンド」を記憶する)

### 5.6 決選投票(再投票フェーズ)の扱い
- 対象ターンの `isRevote` を `true` にし、`revoteCandidateIds` に同数得票者のみを設定する
- 投票ページは `revoteCandidateIds` が設定されている場合、その対象者のみを投票選択肢として表示する
- `votes` フィールドは通常投票時の値を維持するか、決選投票用に別フィールド(`revoteVotes`)を設けるかは実装時に判断してよい(推奨: `revoteVotes` マップを別途持たせ、通常票と混同しない)

---

## 6. 画面仕様

### 6.1 投票ページ(`vote-app`)

お題(topics)フィールドは廃止した。投票画面に表示するのは**参加者名と顔写真のみ**とする。

| 状態 | 表示内容 |
|---|---|
| ターン受付前 | 「まもなく投票が始まります」等の待機表示 |
| 受付中(通常投票) | 参加者ごとの**カード**(顔写真+名前のみ。番号やターン番号等の付随情報は表示しない)をグリッド表示。写真はカードの大部分を占める大きさで表示する。カードをタップして選択(選択中は枠線・配色で強調)し、画面下の「投票する」ボタン(未選択時は非活性)を押して初めて投票が確定する |
| 受付中(決選投票) | 決選投票対象者のみを同じカードUIで表示 |
| 投票送信中 | ローディング表示 |
| 投票完了 | 「投票が完了しました。結果は会場のスクリーンをご覧ください」等(同ラウンド中は他者の投票による再描画でも維持する) |
| 送信失敗 | エラー表示+再送ボタン(オフラインキューイングに依存せず、明示的なリトライUIを必須とする) |
| 受付終了後 | 「このターンの投票は終了しました」表示 |

いずれの状態遷移も、管理者側の操作(受付開始/終了・ターン切り替え・大会開始/終了・決選投票開始)を検知して**リロードなしで自動的に**切り替わること(5.5参照)。

カードUIのデザイン方針:
- 参加者一覧は2列グリッド(`repeat(2, minmax(0, 1fr))`。画面が広い場合(目安560px以上)のみ3列)で表示する。参加者数に応じて自動で列数を増減させる `auto-fit` は、画面幅ぎりぎりの端末で列の最小幅がグリッド計算と噛み合わず、はみ出し・クリッピングが発生する場合があるため採用しない
- 各カードは黒枠+ベタ塗りのハードシャドウ(ぼかし無しのオフセット影)を効かせた紙(コミック風の台紙)のような見た目とし、**写真はカードの大部分(縦横比4:5程度)を占める大きさ**で表示する。写真の下に名前のみの帯を配置し、奇数カード/偶数カードで黒背景・白文字/白(生成りの紙色)背景・黒文字を交互に切り替える
- 参加者ごとの番号表記(バッジ等)は行わない
- 配色は**赤・白・黒を基調**とし、選択中のカードや強調表示など機能上必要な箇所に限り黄色を差し色として使ってよい(得票数などのデータを表す配色ではないことに注意)
- 「投票する」ボタンは常に画面下部に固定し、参加者カードの一覧はその上をスクロールする領域として独立させる。一覧のスクロール領域には固定ボタンに隠れないよう十分な下余白を確保する
- 大人数が同時アクセスしても遅延が発生しないよう、外部UIライブラリ・追加フォント・追加画像アセット等は使わず素のDOM操作・CSSのみで実装し、軽量さを最優先する(vote-appの技術方針は2章参照)
- 背景は赤系(放射状の集中線パターン等、画像を使わずCSSのグラデーションのみで表現)とする
- 参加者名は長さが不定であるため、カード内のテキストは折り返し(`overflow-wrap`)や最大行数での省略に対応し、名前の長さでレイアウトが崩れないようにする。これは投票ページ・管理者ページの双方に共通する注意点とする

### 6.2 管理者ページ(`admin-app`)

- 大会全体の開始・終了ボタン
- 参加者の登録/編集、および**顔写真のアップロード**(Cloud Storage for Firebaseに保存し `photoUrl` を更新。CSV等の一括登録機能は要検討)
- 各ターン(対戦表)の作成・編集(参加者の変更)・削除。**進行状況(pending/accepting/closed)によらず編集・削除できる**
- 「受付開始」ボタン(5.4.2参照。押すと同時に「現在のターン」への切り替えと受付開始を行う)・「受付終了」ボタン
- ターン結果確定操作(得票トップの参加者を `winnerId` にセット。同数得票時は決選投票へ誘導)
- 決選投票の開始ボタン(同数得票者を自動検出して候補提示できると望ましい)
- **決勝ターンの自動作成**操作(5.4.1参照。各ターンで確定した勝者を自動的に参加者として設定した新しいターンを作成する)
- **作成済みの全ターンの得票結果**(バーチャート等)を一覧表示する。現在進行中のターンだけでなく、これまでの全ターンの結果を常時閲覧できること
- この画面をそのままプロジェクターに投影して観覧者向け表示を兼ねる

---

## 7. セキュリティルール(方針・確定)

`turns.votes` 以外の書き換えを拒否したい一方、管理者操作も同じ未認証クライアントSDKから行われるため、両立には認証が必要と判断し、**管理者ページにのみ Firebase Authentication(メール/パスワード)によるログインを追加**した。管理者アカウントは Firebase Console で事前作成する運用とし、アプリ側にサインアップ機能は用意しない。

### 7.1 Firestore(`firestore.rules`)
- `tournament/state`・`participants/{id}` への書き込みは認証済みユーザー(管理者)のみ許可
- `turns/{turnId}` への書き込み: 認証済みユーザーは全フィールド更新可。未認証でも `votes` または `revoteVotes` のみを変更する更新は許可する(投票ページからの書き込み用。他フィールドの書き換えは拒否する最低限のルール)
- 全コレクションの読み取りは誰でも可

### 7.2 Cloud Storage(`storage.rules`)
- `participant-photos/{fileName}` の読み取りは誰でも可(投票ページでの表示用)
- 書き込みは認証済みユーザーのみ、かつ画像ファイル・5MB未満に限定する

---

## 8. 実装の推奨ステップ

1. Docker環境構築(`docker-compose.yml`、両アプリのDockerfile・雛形プロジェクト作成、Firebase CLIのDocker化)
2. Firebaseプロジェクトの作成・Firestore/Authentication/Storage有効化・`firebase.json`/`firestore.rules`/`storage.rules`の初期設定
3. Firestoreデータモデルに沿ったコレクションの作成(管理者ページからの登録)
4. 管理者ページ: ログイン機能(Firebase Authentication)の実装
5. 管理者ページ: 参加者登録・写真アップロード機能の実装
6. 管理者ページ: 大会/ターン制御機能(作成・編集・削除・受付開始終了)の実装
7. 投票ページ: 進行状況のリアルタイム購読と画面自動切り替え、投票フロー(状態表示→投票→完了)の実装
8. 管理者ページ: リアルタイム結果表示の実装
9. 決選投票フロー・決勝ターン自動作成の実装
10. Firebase Hostingへのデプロイ設定
11. 回線混雑を想定した負荷確認(可能であれば複数端末での同時アクセステスト。特に投票ページのリアルタイムリスナーが増えた分の負荷に注意)

---

## 9. オープン事項(実装時に判断・確認が必要)

以下は決定済み(詳細は README.md「実装時の判断」参照):
- [x] Firebase Local Emulator Suiteは使わず、開発時も本番Firebaseに直接接続する
- [x] `vote-app` のバンドラは Vite を採用
- [x] 受付終了後・開始前の投票ページの表示内容は6.1の表の通り確定
- [x] 管理者操作の保護は Firebase Authentication(メール/パスワード)で実施(7章)

未解決:
- [ ] 参加者の一括登録フォーマット(CSV/JSON)。現状は管理画面からの個別フォーム入力のみ
- [ ] 大会終了後の結果エクスポート要否・方法