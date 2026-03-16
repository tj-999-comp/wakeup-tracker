# Apps Script 記録 API / ショートカット実装ドキュメント

## 概要
このドキュメントは、Wakeup Tracker で実装した以下の内容をまとめたものです。

- Google Apps Script による記録用 Web API
- iPhone ショートカットによる起床記録フロー
- 動作確認の手順
- 現在の実装状況

このプロジェクトでは、起床時に iPhone のウィジェットからショートカットを起動し、`平日 / 休日` を選択するだけで記録できるようにしています。  
記録データは Google スプレッドシートへ保存されます。

---

## 実装した構成
現在の構成は以下の通りです。

- **入力**: iPhone ショートカット（ウィジェット起動）
- **送信先**: Google Apps Script の Web アプリ
- **保存先**: Google スプレッドシート

流れとしては以下です。

1. iPhone のウィジェットからショートカットを起動する
2. 「平日」または「休日」を選択する
3. 現在時刻を `wakeup_time` として取得する
4. `day_type` を `weekday / holiday` に変換する
5. Apps Script の Web API に JSON で送信する
6. Apps Script が Google スプレッドシートへ 1 行追加する

---

## Apps Script 側の実装

### 設定値
`Code.gs` では最初に記録先の設定値を定義します。

- `SPREADSHEET_ID`
- `SHEET_NAME`

### 役割
- `SPREADSHEET_ID`: 記録先の Google スプレッドシート ID
- `SHEET_NAME`: 書き込み先のシート名

### 例
```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const SHEET_NAME = 'records';
```

---

### testAppendRecord()
`testAppendRecord()` は、Apps Script からスプレッドシートへ正しく書き込めるかを確認するためのテスト関数です。

### 目的
- スプレッドシート ID が正しいか確認する
- シート名が正しいか確認する
- Apps Script に書き込み権限があるか確認する

### 例
```javascript
function testAppendRecord() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  sheet.appendRow([new Date(), '06:45', 'weekday']);
}
```

### 確認内容
この関数を手動実行し、シートに 1 行追加されればシート接続は成功です。

---

### jsonResponse()
`jsonResponse()` は、Web API のレスポンスを JSON 形式で返すための共通関数です。

### 目的
- `doGet()` と `doPost()` の���スポンス形式を統一する
- クライアント側で扱いやすい JSON を返す

### 例
```javascript
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

### doGet()
`doGet()` は、Web アプリが正常に起動しているか確認するためのエンドポイントです。

### 目的
- Web アプリ URL の生存確認
- デプロイ後の簡易疎通確認

### 例
```javascript
function doGet() {
  return jsonResponse({
    ok: true,
    message: 'wake-up API is running'
  });
}
```

### 想定レスポンス
```json
{"ok":true,"message":"wake-up API is running"}
```

---

### doPost(e)
`doPost(e)` は、この API の本体です。  
外部クライアントから JSON を受け取り、スプレッドシートへ記録します。

### 受け取る値
- `wakeup_time`
- `day_type`

### 想定リクエスト
```json
{
  "wakeup_time": "06:42",
  "day_type": "weekday"
}
```

### 主な処理
1. リクエストボディを取得する
2. JSON をパースする
3. `wakeup_time` と `day_type` を取り出す
4. 必須項目をチェックする
5. `day_type` が `weekday` または `holiday` か確認する
6. スプレッドシートを取得する
7. 1 行追加する
8. JSON 形式で結果を返す

### 例
```javascript
function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : '{}';
    const body = JSON.parse(raw);

    const wakeupTime = body.wakeup_time;
    const dayType = body.day_type;

    if (!wakeupTime || !dayType) {
      return jsonResponse({
        ok: false,
        error: 'wakeup_time and day_type are required'
      });
    }

    if (!['weekday', 'holiday'].includes(dayType)) {
      return jsonResponse({
        ok: false,
        error: 'day_type must be weekday or holiday'
      });
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: 'sheet not found'
      });
    }

    sheet.appendRow([
      new Date(),
      wakeupTime,
      dayType
    ]);

    return jsonResponse({
      ok: true,
      message: 'record inserted'
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message
    });
  }
}
```

---

## 保存されるデータ形式
現在の実装では、スプレッドシートに以下の順番で保存します。

1. `recorded_at`
2. `wakeup_time`
3. `day_type`

### 例
| recorded_at | wakeup_time | day_type |
| --- | --- | --- |
| 2026-03-16 06:42:10 | 06:42 | weekday |
| 2026-03-17 08:15:02 | 08:15 | holiday |

### 各値の意味
- `recorded_at`: Apps Script が受信した日時
- `wakeup_time`: ショートカットから送られてきた時刻
- `day_type`: `weekday` または `holiday`

---

## Apps Script 実装手順
今回の実装は、以下の順で進めました。

### 1. `Code.gs` を 1 ファイル構成で作成
最初はファイルを分けず、`Code.gs` に一本化しました。  
今回の規模ではその方が管理しやすく、`doGet()` / `doPost()` の場所も明確になります。

### 2. 設定値を定義
- `SPREADSHEET_ID`
- `SHEET_NAME`

を定義し、保存先を固定しました。

### 3. `testAppendRecord()` でシート接続を確認
Apps Script からスプレッドシートへ 1 行追加できることを確認しました。

### 4. `doGet()` を実装
ブラウザから Web アプリ URL を開き、疎通確認できるようにしました。

### 5. `doPost()` を実装
JSON を受け取り、値を検証したうえでシートへ追記する処理を実装しました。

### 6. Web アプリとしてデプロイ
Apps Script を Web アプリとして公開し、外部からアクセスできる URL を取得しました。

### 7. curl で POST テスト
POST リクエストを送り、スプレッドシートにデータが追記されることを確認しました。

---

## iPhone ショートカッ���側の実装

### 目的
iPhone のウィジェットからワンタップで起床記録できるようにすることです。

### ショートカットの流れ
1. ウィジェットからショートカットを起動
2. 「平日 / 休日」を選択
3. 現在日時を取得
4. `HH:mm` 形式へフォーマット
5. `day_type` を `weekday / holiday` に変換
6. JSON を作成
7. Apps Script API に POST
8. 完了メッセージを表示

### 送信する JSON
```json
{
  "wakeup_time": "06:42",
  "day_type": "weekday"
}
```

### 実装上のポイント
- 表示は「平日 / 休日」
- 送信値は `weekday / holiday`
- `wakeup_time` は `HH:mm` 文字列で送る
- API の `Content-Type` は `application/json`

---

## iPhone ショートカット 詳細手順

### 1. 新しいショートカットを作成
- iPhone の「ショートカット」アプリを開く
- 右上の `+` から新規ショートカットを作成する
- 名前を `起床記録` などに設定する

### 2. 平日 / 休日の選択を作る
- 「メニューから選択」または「リストから選択」アクションを追加する
- 選択肢を以下の 2 つにする
  - 平日
  - 休日

### 3. 送信用の値に変換する
表示は日本語ですが、API に送る値は英語に固定します。

- 平日 → `weekday`
- 休日 → `holiday`

If 文などを使って、選択結果を `day_type` に変換します。

### 4. 現在日時を取得する
- 「現在の日付を取得」アクションを追加する

### 5. 起床時刻を `HH:mm` に整形する
- 「日付をフォーマット」アクションを追加する
- フォーマットは `HH:mm` にする

これで `06:42` のような文字列を作ります。

### 6. JSON 用の辞書を作成する
- 「辞書」アクションを追加する
- 以下の 2 つのキーを設定する
  - `wakeup_time`
  - `day_type`

例:
```json
{
  "wakeup_time": "06:42",
  "day_type": "weekday"
}
```

### 7. Apps Script API に POST する
- 「URL の内容を取得」アクションを追加する
- URL に Web アプリ URL を設定する
- メソッドは `POST`
- ヘッダは `Content-Type: application/json`
- リクエスト本文は作成した辞書を JSON として送る

### 8. 実行結果を表示する
- 「通知を表示」または「結果を表示」アクションを追加する
- 例: `起床記録を保存しました`

### 9. ウィジェットから起動できるようにする
- ショートカットをホーム画面またはウィジェットに追加する
- 起床時にすぐ押せる位置に配置する

---

## 動作確認手順

### Apps Script 側
以下を順番に確認しました。

1. `testAppendRecord()` 実行
2. スプレッドシートに追記されることを確認
3. Web アプリとしてデプロイ
4. `doGet()` の応答確認
5. `curl` で `doPost()` の動作確認
6. スプレッドシートへ記録されることを確認

### curl での確認例
```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{"wakeup_time":"06:42","day_type":"weekday"}'
```

### iPhone ショートカット側
以下を確認しました。

1. ショートカットを実機で起動できる
2. 平日 / 休日を選択できる
3. Apps Script API へ送信できる
4. スプレッドシートへ記録される
5. ウィジェット起動でも問題なく動作する

---

---

## 実装状況メモ
2026-03 時点で、起床記録の基本機能は実装済みです。

### 完了した内容
- Google スプレッドシートの記録先を作成
- Google Apps Script で記録用 Web API を実装
- Web アプリとしてデプロイ
- `doGet()` / `doPost()` の疎通確認
- curl による POST テスト
- iPhone ショートカットを作成
- ウィジェットから起動できるように設定
- 実機から API に送信し、スプレッドシートへ記録されることを確認

### 関連ドキュメント
- [Apps Script 記録 API / ショートカット実装ドキュメント](docs/apps-script-api.md)

### 次にやること
- 週次集計ロジックの実装
- HTML メールレポートの作成
- 毎週月曜日の自動送信設定