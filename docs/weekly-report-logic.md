# 週次集計ロジック ドキュメント

## 概要
このドキュメントは、Wakeup Tracker における週次集計ロジックの実装内容を説明するものです。

現在の週次集計ロジックは Google Apps Script の `Report.gs` に実装されています。  
目的は、Google スプレッドシートの `records` シートに保存された起床記録をもとに、前週 1 週間分の集計結果を生成することです。

この集計結果は、今後 HTML メールレポートを生成するための元データとして利用します。

---

## 対象データ
集計対象となるシートは `records` です。

想定している列構成は以下の通りです。

| 列 | 項目名 | 内容 |
| --- | --- | --- |
| A | `recorded_at` | 記録日時 |
| B | `wakeup_time` | 起床時刻 |
| C | `day_type` | `weekday` または `holiday` |
| D | `weekday_label` | `月` / `火` / `水` / `木` / `金` / `土` / `日` |

### 補足
- `recorded_at` は週の範囲判定に使用します
- `wakeup_time` は平均、最早、最遅の計算に使用します
- `day_type` は平日 / 休日の分類に使用します
- `weekday_label` は表示用に使用します

---

## 集計の基本方針
週次集計では、以下の考え方でデータを扱います。

### 1. 週の区切りは `recorded_at` を使う
週の判定は D 列の曜日ではなく、A 列の `recorded_at` を基準に行います。

理由は、D 列の曜日だけでは「どの週��月曜日か」が区別できないためです。  
そのため、集計対象は以下のように日付範囲で決定します。

- 前週の月曜日 00:00:00
- 前週の日曜日 23:59:59

### 2. 平日 / 休日の分類は `day_type` を使う
平日と休日の平均起床時刻を分けて計算するため、C 列の `day_type` を使います。

### 3. D 列の曜日は表示用に使う
D 列の `weekday_label` は、日別一覧や最早 / 最遅の表示に使います。

---

## 実装ファイル
週次集計ロジックは `Report.gs` にまとめています。

`Code.gs` には API 関連の処理を置き、`Report.gs` に集計関連の処理を分離することで、役割を明確にしています。

### 役割分担
- `Code.gs`
  - `doGet()`
  - `doPost()`
  - `jsonResponse()`
  - `testAppendRecord()`
- `Report.gs`
  - 集計対象週の算出
  - 記録データの取得
  - 平均起床時刻の計算
  - 最早 / 最遅記録の算出
  - 日別一覧の整形
  - デバッグログ出力

---

## 実装されている関数

### runWeeklyAggregationDebug()
週次集計を実行し、結果を `Logger.log()` に出力するデバッグ用関数です。

### 目的
- 集計ロジック単体の動作確認
- HTML メール送信実装前の事前確認
- スプレッドシート上のデータを使った検証

### 処理の流れ
1. 前週の範囲を取得する
2. 対象週の記録を取得する
3. 集計結果を算出する
4. ログに出力する

---

### getLastWeekRange()
前週の月曜日から日曜日までの期間を求める関数です。

### 返す値
```json
{
  "start": "前週月曜日 00:00:00",
  "end": "前週日曜日 23:59:59"
}
```

### 用途
週次レポートの対象期間を固定するために使います。

### 例
2026-03-16（月）に実行した場合:

- `start`: 2026-03-09 00:00:00
- `end`: 2026-03-15 23:59:59

---

### getWeeklyRecords(startDate, endDate)
`records` シートから、指定した期間に含まれる行だけを取得する関数です。

### 実装上のポイント
この関数では、`getValues()` と `getDisplayValues()` を併用しています。

#### `recorded_at` は `getValues()` を使用
A 列の `recorded_at` は日付比較に使用するため、Date オブジェクトとして取得します。

#### `wakeup_time` は `getDisplayValues()` を使用
B 列の `wakeup_time` は、シート内部では時刻型として扱われることがあります。  
そのまま `getValues()` で取得すると、Apps Script 上では `1899-12-30` を含む Date 表現として扱われることがあり、平均計算や比較に不向きです。

そのため、B 列については `getDisplayValues()` で表示文字列を取得し、`07:05` のような `HH:mm` 形式として扱います。

#### 戻り値
各行を以下のようなオブジェクトに整形して返します。

```json
[
  {
    "recordedAt": "Date",
    "wakeupTime": "07:05",
    "dayType": "weekday",
    "weekdayLabel": "月"
  }
]
```

---

### normalizeWakeupTime(value)
`wakeup_time` を `HH:mm` 形式へ正規化する関数です。

### 目的
スプレッドシートから取得した表示文字列を、集計で扱いやすい形式にそろえることです。

### 例
- `7:05` → `07:05`
- `07:05` → `07:05`

この関数により、以降の平均計算や最早 / 最遅判定を安定して行えます。

---

### calculateWeeklyStats(records, range)
対象週の記録データから、週次集計結果を作る中心関数です。

### 集計する項目
- 対象期間
- 総記録数
- 記録日数
- 平日平均起床時刻
- 休日平均起床時刻
- 全体最早起床
- 全体最遅起床
- 平日最早起床
- 平日最遅起床
- 休日最早起床
- 休日最遅起床
- 日別一覧

### 平日 / 休日別の earliest / latest
全体 earliest / latest に加えて、以下も別々に集計します。

- `weekdayEarliest`
- `weekdayLatest`
- `holidayEarliest`
- `holidayLatest`

これにより、平日と休日それぞれの傾向を見やすくできます。

---

### calculateAverageWakeupTime(records)
指定された記録群の平均起床時刻を計算します。

### 計算方法
1. `HH:mm` を分単位に変換する
2. 合計する
3. 件数で割る
4. `HH:mm` に戻す

### 例
- `07:05` → 425 分
- `08:47` → 527 分

このように一度数値化することで、平均時刻を計算しています。

---

### findEarliestRecord(records)
指定された記録群の中から、最も早い起床時刻のレコードを返します。

---

### findLatestRecord(records)
指定された記録群の中から、最も遅い起床時刻のレコードを返します。

---

### countUniqueRecordDays(records)
対象週の中で、何日分の記録があるかを数える関数です。

### 補足
単純な行数ではなく、`yyyy-MM-dd` 単位でユニークな日数を数えています。  
これにより、将来的に 1 日複数記録があっても扱いやすくなります。

---

### toRecordSummary(record)
最早 / 最遅レコードを、レポート出力しやすい形式に整形する関数です。

### 返す形式
```json
{
  "date": "2026-03-13",
  "weekday": "金",
  "wakeupTime": "07:01",
  "dayType": "weekday"
}
```

---

### timeToMinutes(timeStr)
`HH:mm` を分単位に変換する補助関数です。

### 例
- `07:05` → 425
- `09:20` → 560

---

### minutesToTime(totalMinutes)
分単位の数値を `HH:mm` に戻す補助関数です。

### 例
- `425` → `07:05`
- `560` → `09:20`

---

### formatDate(date)
Date オブジェクトを `yyyy-MM-dd` 形式に整える補助関数です。

---

## 現在の出力例
現在のデバッグ出力では、以下のような JSON が得られます。

```json
{
  "period": {
    "start": "2026-03-09",
    "end": "2026-03-15"
  },
  "totalRecords": 7,
  "recordDays": 7,
  "weekdayAverage": "08:02",
  "holidayAverage": "09:10",
  "earliest": {
    "date": "2026-03-13",
    "weekday": "金",
    "wakeupTime": "07:01",
    "dayType": "weekday"
  },
  "latest": {
    "date": "2026-03-15",
    "weekday": "日",
    "wakeupTime": "09:20",
    "dayType": "holiday"
  },
  "weekdayEarliest": {
    "date": "2026-03-13",
    "weekday": "金",
    "wakeupTime": "07:01",
    "dayType": "weekday"
  },
  "weekdayLatest": {
    "date": "2026-03-10",
    "weekday": "火",
    "wakeupTime": "08:47",
    "dayType": "weekday"
  },
  "holidayEarliest": {
    "date": "2026-03-14",
    "weekday": "土",
    "wakeupTime": "09:00",
    "dayType": "holiday"
  },
  "holidayLatest": {
    "date": "2026-03-15",
    "weekday": "日",
    "wakeupTime": "09:20",
    "dayType": "holiday"
  },
  "dailyList": [
    {
      "date": "2026-03-09",
      "weekday": "月",
      "wakeupTime": "07:05",
      "dayType": "weekday"
    }
  ]
}
```

---

## 実装時にハマりやすい点

### 1. `wakeup_time` の型
スプレッドシートの時刻セルは、`getValues()` で取得すると内部的に Date として扱われることがあります。  
これにより、`1899-12-30` を含む値になり、集計が崩れることがあります。

そのため、`wakeup_time` は `getDisplayValues()` を使って文字列として扱う実装にしています。

### 2. 曜日列だけでは週は判定できない
D 列に曜日が入っていても、それだけでは「どの週の月曜か」は判定できません。  
そのため、週の判定には `recorded_at` を使います。

### 3. 0件データの扱い
対象週にデータがない場合でも、落ちないように `null` を返す設計にしています。

---

## 今後このロジックをどう使うか
次のステップでは、この集計結果を使って HTML 形式の週次レポートを作成します。

具体的には、以下のような用途を想定しています。

- 週次レポートメールの本文生成
- 平日 / 休日ごとの比較表示
- 日別一覧表の生成
- 最早 / 最遅記録のハイライト表示

---

## 現在の実装状況
現時点で、以下が完了しています。

- 前週月曜〜日曜の対象期間算出
- `records` シートから対象週データを抽出
- `wakeup_time` の正規化
- 平日平均 / 休日平均の算出
- 全体 earliest / latest の算出
- 平日 earliest / latest の算出
- 休日 earliest / latest の算出
- 記録日数の算出
- 日別一覧の整形
- デバッグログでの確認

これにより、週次レポート生成のための集計ロジックは実装完了と判断できます。

---

## 次の作業
次は、この集計結果を使って HTML メール本文を生成する処理を実装する予定です。