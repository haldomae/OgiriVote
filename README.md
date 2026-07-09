# 大喜利大会 投票サイト

`CLAUDE.md` の仕様に基づくトーナメント投票 Web アプリ。詳細仕様は [CLAUDE.md](./CLAUDE.md) を参照。

## 構成

- `vote-app/` — 投票ページ(Vite + TypeScript + Firestore フルSDK。進行状況を `onSnapshot` で購読して自動的に画面が切り替わる。得票数自体は購読しない)
- `admin-app/` — 管理者ページ(React + Vite + TypeScript、Firestore フルSDK + onSnapshot + Firebase Authentication + Cloud Storage)
- `firebase.json` / `firestore.rules` / `storage.rules` / `firestore.indexes.json` / `.firebaserc` — リポジトリルート直下。Firebase CLI は `hosting.public` を「設定ファイルのあるディレクトリ配下」にしか解決できない(`../` 等で外に出るパスは `Error: ... is outside of project directory` になる)ため、`vote-app/`・`admin-app/` と同じ階層(ルート)に置いている
- `firebase/Dockerfile` — Firebase CLI(`firebase-tools`)をDocker化するための定義のみ置く(設定ファイル本体はルートにある)
- `docker-compose.yml` — ローカル開発用(Node.js非依存で `docker compose up` のみで起動)

## セットアップ手順

### 1. Firebase プロジェクトの準備

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成し、Firestore を有効化する
2. Cloud Storage for Firebase を有効化する(参加者の写真保存用)
3. Firebase Authentication を有効化し、**メール/パスワード方式**をオンにする(管理者ログイン用。下記「実装判断」参照)
4. Authentication > Users から管理者アカウントを手動で1つ以上作成する(アプリ側にサインアップ機能はない)
5. Web アプリを追加し、`firebaseConfig` の値を控える(`storageBucket` の値も忘れずに)

### 2. 環境変数の設定

`vote-app/.env.example` と `admin-app/.env.example` をそれぞれ `.env` としてコピーし、Firebase の設定値を入力する。

```
cp vote-app/.env.example vote-app/.env
cp admin-app/.env.example admin-app/.env
```

### 3. Firebase CLI 設定(ローカルにNode.jsが無い場合)

ローカルPCにNode.js/npmをインストールしない前提のため、Firebase CLIも `docker-compose.yml` の `firebase-cli` サービス(Docker化済み)経由で実行する。`docker compose run --rm firebase-cli <コマンド>` が `firebase <コマンド>` に相当する。

`.firebaserc`(リポジトリルート)の `YOUR_FIREBASE_PROJECT_ID` を実際のプロジェクトIDに置き換える(Hosting のマルチサイトを使わない場合は `targets` ブロックと `firebase.json` の `hosting` を単一サイト構成に書き換えてよい)。

初回はログインが必要。コンテナにはブラウザが無いため `--no-localhost` を付け、表示されたURLを手元のブラウザで開いて認証コードを貼り付ける(ログイン情報は名前付きボリュームに保存され、以降のコンテナ実行でも保持される)。

```
docker compose run --rm firebase-cli login --no-localhost
```

Hosting をマルチサイト構成(投票ページ/管理者ページを別サイト)で使う場合、Firebase Console の Hosting でサイトを2つ作成した上で、ターゲットを紐付ける(`.firebaserc` の `targets` が自動更新される)。

```
docker compose run --rm firebase-cli target:apply hosting vote <vote-site-id>
docker compose run --rm firebase-cli target:apply hosting admin <admin-site-id>
```

Firestore / Storage ルールのデプロイ:

```
docker compose run --rm firebase-cli deploy --only firestore,storage
```

### 4. ローカル開発

```
docker compose up
```

- 投票ページ: http://localhost:5173
- 管理者ページ: http://localhost:5174

`node_modules` はホストを汚染しないよう名前付きボリュームに格納される。`package.json` を変更した場合はコンテナを再起動すれば `npm install` が再実行される。

### 5. 大会運営の流れ(管理者ページ)

1. 管理者ページにログイン
2. 「参加者管理」で参加者を登録し、任意で顔写真をアップロード(投票ページに表示される)
3. 「ターン(対戦表)管理」でターンを作成(参加者を2名以上選択)
4. 「大会全体の制御」で大会開始
5. 各ターンで「受付開始」を押す(現在のターンへの切り替えと受付開始を同時に行う)→ 投票ページが自動的に投票画面へ切り替わる(リロード不要) → 「受付終了」
6. 「勝者を確定」。同数得票の場合は「決選投票」パネルに表示されるので「決選投票を開始」
7. 各ターンの勝者が出揃ったら「決勝ターンを作成」(勝者が自動的に決勝の参加者として設定される)
8. 決勝ターンも同様に受付開始→終了→勝者確定
9. 全ターン終了後「大会終了」

ターンは進行状況にかかわらず「編集」(参加者の変更)や「削除」が可能。「投票結果」パネルには作成済みの全ターンの得票状況が常時表示される(進行中のターンだけでなく過去のターンも閲覧可能)。

投票ページは参加者の顔写真+名前のカードを一覧表示し、カードをタップして選択したうえで「投票する」ボタンを押すと投票が確定する(お題の表示機能は廃止した)。

## 本番環境へのデプロイ手順

### 0. 前提条件(初回のみ・チェックリスト)

- [ ] Firebase プロジェクトを作成し、**Firestore** / **Authentication(メール/パスワード)** / **Cloud Storage** を有効化済み(「セットアップ手順 1」参照)
- [ ] Authentication に管理者アカウントを最低1つ作成済み
- [ ] `vote-app/.env` `admin-app/.env` に本番Firebaseプロジェクトの `firebaseConfig` 値を設定済み
- [ ] `docker compose run --rm firebase-cli login --no-localhost` でログイン済み
- [ ] Firebase Console の Hosting で投票用・管理者用の2サイトを作成し、`.firebaserc` の `targets` に実在するサイトIDのみが設定されている(プレースホルダーが残っていないこと。マルチサイトを使わない場合は `firebase.json` の `hosting` と `.firebaserc` の `targets` を単一サイト構成に書き換える)

チェックが済んでいなければ、README上部の「セットアップ手順」1〜3を先に行う。

### 1. Firestore / Storage のセキュリティルールをデプロイ

コードの `firestore.rules` / `storage.rules` を変更した場合は、アプリ本体より先にルールを反映する(ルール未反映のまま新機能を先に公開すると、書き込みが拒否される時間帯が生まれるため)。

```
docker compose run --rm firebase-cli deploy --only firestore:rules,storage
```

### 2. 両アプリを本番ビルド

Docker経由でビルドする(各アプリのコンテナの既定コマンド `npm install && npm run dev` を、`npm run build` を明示的に指定して上書きする)。

```
docker compose run --rm vote-app sh -c "npm install && npm run build"
docker compose run --rm admin-app sh -c "npm install && npm run build"
```

成功すると `vote-app/dist/` `admin-app/dist/` が生成される(ホスト側にも書き出されるので、`firebase-cli` コンテナからも `/workspace` 経由で参照できる)。

### 3. Hosting へデプロイ

```
docker compose run --rm firebase-cli deploy --only hosting
```

マルチサイト構成の場合、`firebase.json` の `target` 設定に従って `vote` サイトには `vote-app/dist`、`admin` サイトには `admin-app/dist` がそれぞれ自動的にデプロイされる。特定のサイトだけ更新したい場合は `--only hosting:vote` のように対象を絞れる。

> **注**: `firebase.json` は必ずリポジトリルートに置くこと。`hosting.public` は「`firebase.json` があるディレクトリの配下」しか参照できず、`../vote-app/dist` のように親ディレクトリへ抜けるパスを指定すると `Error: ... is outside of project directory` でデプロイに失敗する(初回デプロイ時に実際に遭遇し、設定ファイル一式を `firebase/` から直下に移動して解決した)。

まとめて実行する場合:

```
docker compose run --rm vote-app sh -c "npm install && npm run build"
docker compose run --rm admin-app sh -c "npm install && npm run build"
docker compose run --rm firebase-cli deploy --only hosting,firestore:rules,storage
```

### 4. デプロイ後の動作確認

- 投票ページ(https://ogirivote-86481.web.app )にスマホでアクセスし、待機画面が表示されること
- 管理者ページ(https://ogirivote-86481-admin.web.app )にアクセスし、作成済みの管理者アカウントでログインできること
- 管理者ページで参加者を1名テスト登録し、写真アップロードが成功すること(Cloud Storageのルールが正しく反映されているかの確認を兼ねる)
- テスト用のターンを作成→受付開始し、投票ページ側の画面が**リロードなしで**自動的に投票画面へ切り替わることを確認する
- テスト投票を1件送信し、管理者ページの「投票結果」パネルに反映されることを確認する
- 確認後、テスト用の参加者・ターンは管理画面から削除しておく

### 5. ロールバックが必要な場合

Hosting のみ即座に前のリリースへ戻せる。

```
docker compose run --rm firebase-cli hosting:clone <SOURCE_SITE_ID>:<VERSION_ID> <TARGET_SITE_ID>:live
```

または Firebase Console の Hosting > 該当サイト > 「リリース履歴」から過去のバージョンを選んで「ロールバック」する方が簡単。Firestore/Storage のルールは変更履歴が残らないため、`firestore.rules` / `storage.rules` を Git 等でバージョン管理し、必要なら以前の内容に戻して再デプロイする。

### 6. 大会当日の運用チェックリスト

- [ ] 前日までに参加者登録・写真アップロードを完了しておく
- [ ] 管理者アカウントでログインできることを当日の会場Wi-Fiで再確認する
- [ ] 投票ページのURL(QRコード)を来場者向けに準備する
- [ ] 大会開始前に「大会全体の制御」で大会を開始する

## 実装時の判断(CLAUDE.md 9章 オープン事項への回答)

- **Firebase Local Emulator Suite**: 使用せず、開発時も本番 Firebase プロジェクトに直接接続する構成にした(CLAUDE.md 4.2の指示通り)。エミュレータを使いたい場合は `firebase.ts` の初期化後に `connectFirestoreEmulator` / `connectAuthEmulator` を追加する。
- **vote-app のバンドラ**: Vite を採用。
- **参加者・対戦表の一括登録**: 今回は管理画面からの個別フォーム入力のみを実装した(CSV一括登録は未実装、将来の拡張ポイント)。
- **投票ページの受付前後の表示**: CLAUDE.md 6.1 の表に従い実装済み(待機/受付中/決選投票/送信中/完了/失敗/受付終了後の7状態)。
- **大会終了後の結果エクスポート**: 未実装。必要であれば Firestore の `turns` コレクションを管理画面や Firebase Console からエクスポートする運用を想定。
- **Firestore/Storage セキュリティルール(7章)との整合性**: CLAUDE.md は「`turns.votes` 以外の書き換えを拒否する最低限のルール」を要求する一方、管理者操作(大会/参加者/ターン管理、写真アップロード)も同じ未認証クライアントSDKから行われるため、認証なしでは両立できない。そこで **管理者ページにのみ Firebase Authentication(メール/パスワード)によるログインを追加**し、`firestore.rules` は「投票(`votes`/`revoteVotes`のみの更新)は誰でも可・それ以外の書き込みは認証済みユーザーのみ」、`storage.rules` は「参加者写真の読み取りは誰でも可・書き込みは認証済みユーザーのみ」という形にした。投票の多重投票対策自体は仕様通り実装していない。
- **投票ページのリアルタイム化**: 当初「投票ページはリアルタイムリスナーを持たない」方針だったが、リロード不要で画面が自動的に切り替わる要件が追加されたため、`vote-app` を Firestore Lite SDK からフルSDKに切り替え、`tournament/state` と現在のターンのみを `onSnapshot` で購読するようにした。得票数(`votes`/`revoteVotes`)自体は購読・表示せず、状態(`status`/`isRevote`/対象者)が変化したときだけ再描画することで、投票のたびに全クライアントへ再描画が走らないようにしている。
- **「現在のターンにする」と「受付開始」の統合**: 別ボタンだと運用しづらいという指摘を受け、「受付開始」ボタン1つで `writeBatch` により `tournament/state.currentTurnId` の切り替えと `turns/{turnId}.status: "accepting"` を同時に行うようにした。
- **お題(topics)フィールドの廃止**: 管理画面・投票画面の両方からお題入力/表示を削除した。データモデル上も `turns.topics` フィールドは廃止。
- **投票結果の全ターン表示**: 管理画面の結果パネルは現在進行中のターンだけでなく、作成済みの全ターンをターン番号順に一覧表示するようにした。
- **投票ページのカードUI**: 参加者ボタンを即時投票する方式から、「顔写真+名前のカードを選択 → 画面下の『投票する』ボタンで確定」という2ステップの方式に変更した。誤タップでの即時投票を防ぎつつ、スマホでの操作性を優先している。実装は素のDOM操作・CSSのみで、外部UIライブラリは使用していない(大人数の同時アクセスでも軽量に動作させるため)。
