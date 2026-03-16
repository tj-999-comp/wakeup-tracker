# 概要

この文書は、Apps Scriptを使用してウェイクアップトラッキングを行うためのWeb APIの実装について説明します。このAPIは、Google Sheetsにウェイクアップ時間と日付タイプを記録するためのもので、シンプルかつ効率的に設計されています。

# 設定値

スクリプトを設定するために、次の手順を行います：
1. Google Sheetsを開き、新しいスプレッドシートを作成します。
2. スクリプトエディタを開き、以下のコードを入力します。
3. 必要に応じて、シートのアクセス権限を設定します。

# testAppendRecord()

この関数は、ウェイクアップ記録をスプレッドシートに追加するために使用されます。テストを行うことができ、適切に記録されるか確認することができます。関数の実装例は以下の通りです。
```javascript
function testAppendRecord() {
    const sheet = SpreadsheetApp.openById('YOUR_SHEET_ID').getActiveSheet();
    const wakeup_time = new Date(); // 現在の時間を取得
    const day_type = 'weekday';  // 日付タイプを設定
    sheet.appendRow([wakeup_time, day_type]);
}
```

# jsonResponse()

この関数は、APIからの応答をJSON形式で返します。指定されたリクエストに対して、適切な情報を提供するためのものです。
```javascript
function jsonResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
```

# doGet()

GETリクエストを処理するための関数です。システムの現在の状態を取得するために使用されます。
```javascript
function doGet(e) {
    const response = {status: 'success', message: 'GETリクエストが成功しました。'};
    return jsonResponse(response);
}
```

# doPost(e)

POSTリクエストを処理するための関数です。ウェイクアップ記録をスプレッドシートに追加するために使用されます。
```javascript
function doPost(e) {
    const wakeup_time = e.parameter.wakeup_time;
    const day_type = e.parameter.day_type;
    const sheet = SpreadsheetApp.openById('YOUR_SHEET_ID').getActiveSheet();
    sheet.appendRow([new Date(wakeup_time), day_type]);
    return jsonResponse({status: 'success', message: 'データが保存されました。'});
}
```

# 保存されるデータ形式

データは以下の形式でGoogle Sheetsに保存されます：
- **wakeup_time**: ユーザーが起きた時刻（Date型）
- **day_type**: 平日または休日（String型）

# 現在の確認状況

現在、このAPIは正常に稼働しており、指定されたウェイクアップ時間と日付タイプを取得してGoogle Sheetsに記録しています。特に注意が必要な点や問題は報告されていません。  
今後の改善点としては、ユーザー認証やデータのバリデーション機能の追加が考えられます。

# 補足メモ

- Google Apps Scriptの設定で、APIをデプロイする際には適切な権限を設定してください。
- エラー処理を適切に行い、ログを記録することを推奨します。