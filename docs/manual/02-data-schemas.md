# 02 データのスキーマと書き方

すべて `"use strict";` で始まる素の JS。ファイルの先頭コメントに「ルール」を書く習慣(このリポジトリの流儀)。文字列内のマークアップは `ST.md`(`**太字**`、`` `code` ``、`[[用語id]]`)。

## 2.1 出典 `js/data/sources.js`
```js
ST.SRC = {
  ipa10: {org:"IPA", label:"情報セキュリティ10大脅威 2026", url:"https://www.ipa.go.jp/security/10threats/10threats2026.html", checked:"2026-10-27"},
  ...
};
```
- キーは短い英数。`org`(発行元)、`label`(画面に出す名前)、`url`(**https のみ**)、`checked`(**実際にページを開いて確認した日 YYYY-MM-DD**)。
- 先に出典を登録 → それを用語・レッスン・クイズから引く。順序を逆にしない。
- 公的機関・標準化団体・一次情報のみ(別テーマなら、その分野の公的機関・学会・標準・公式ドキュメント・法令)。ブログや二次解説は原則使わない。
- 外部教材(演習サイトなど)も同じ表に登録して `practice` から引く。
- 確認日はレッスン・用語の画面に「出典確認日 ○○」として出るので、**開いていないページの確認日を付けない**。再確認したら日付を更新する。

## 2.2 用語 `js/data/terms.js`
```js
ST.TERM_CATS = ["すべて","ネットワーク","暗号",...];   // 絞り込みボタンの分類。先頭は必ず "すべて"
ST.TERMS = [
 {id:"osi", name:"OSI参照モデル / TCP/IPモデル", en:"OSI / TCP/IP Model", cat:"ネットワーク",
  lab:"encap",            // 任意。関連ラボ(ウィジェットid、group 付きのもの)
  sim:"phishing",         // 任意。関連シミュレーター(ST.SC のid)
  summary:"…",            // 1〜2文の定義
  how:"…",                // 仕組み
  risk:"…",               // 危険性(別テーマでは「よくある誤り/注意点」に読み替え可)
  defense:["…","…"],      // 対策の箇条書き(配列)
  src:["nist","rfc9293"]} // 出典キー(必須・1つ以上)
];
ST.TERM = Object.fromEntries(ST.TERMS.map(t => [t.id, t]));   // ファイル末尾
```
- id は小文字英数とハイフン(`[[id]]` の正規表現が `[a-z0-9-]+`)。
- 本文中で他の用語を `[[nat]]` で参照できる。存在しない id は check.js が落とす。
- 用語ページに「理解度 ●○○」(クイズ正誤から計算)、関連ラボ・シミュレーター・関連レッスン・出典・確認日が自動で出る。
- 分類が「法律・倫理」のような特殊枠は、別テーマでは注意枠(下記)に合わせて作り替える。

## 2.3 コースとレッスン `js/data/courses.js`
```js
ST.COURSES = [
 {id:"net", n:"01", title:"ネットワークの基礎", color:"var(--c1)", desc:"…",
  lessons:[
   {id:"net-layers", title:"層とカプセル化", min:6,        // min = 目安の所要分
    requires:[],                                           // 先に読むレッスンid(入口は [])。必須キー
    terms:["osi","ip-address","port"],                     // 関連用語(末尾に一覧表示)
    src:["rfc9293","nist"],                                // 出典(必須・1つ以上)
    practice:["psqli"],                                    // 任意。外部教材(SRCキー)。完了後に表示(LOCK設定時)
    blocks:[ ...ブロック... ]}
  ]}
];
ST.LESSON = {}; ST.COURSES.forEach(...)  // レッスンid → レッスン(course, idx を付与)。ファイル末尾の定型コードをそのまま使う
ST.COURSE = Object.fromEntries(...);
```
ブロックの種類(`views.js` の lesson view が解釈):
| ブロック | 意味 |
|---|---|
| `{p:"段落"}` | 本文。連続する p/h/list/callout/key は読みやすい幅の列(`.prose`)にまとめられる |
| `{h:"見出し"}` | h2 |
| `{list:["…","…"]}` | 箇条書き |
| `{w:"ウィジェットid", o:{…}}` | 図解ラボを埋め込む(全幅)。o は mount の opts(`title` で見出し上書き可) |
| `{callout:"…", kind:"info"|"warn"|"attack"|"ok"}` | 吹き出し注意枠 |
| `{key:["要点","要点"]}` | 「このレッスンのポイント」(必ず最後に置く) |

レッスンの型(守ると画面が揃う):
1. 導入の段落(身近な場面から)→ 直後にウィジェット(操作して確かめる)。
2. 見出し付きで「なぜそうなるか」「狙われる/間違える場所」。
3. 状況を変えて試すよう促す callout(「上のツールで○○をオンにしてみてください」)。
4. 最後に `key` で要点3つ前後。
- 6〜9分で読める量。文は短く、断定は出典で裏付けられる範囲だけ。数値の目安は「単純化した例」「説明用の仮の値」と本文に明記。
- 画面は自動で: 前後レッスンへのナビ、「このレッスンを完了」ボタン(`ST.markLesson`)、関連用語、出典、確認日、「本文はClaudeが出典をもとに作成した解説です」の注記を出す。

### requires(スキルツリー)の書き方
- 「この話を理解するのに必要な知識」の関係だけ。コースをまたいでよい。入口は `[]`。
- check.js が、`requires` の書き忘れ・未登録id・自己参照・**循環**を検出。
- 現状 `ST.LOCK="off"`(ロックせず「おすすめの順番:先に○○」と案内)。"soft"(「それでも読む」ボタン付きのゲート)/"hard" に切り替え可能。切り替えは core.js の1行。
- ラボ(単独ページ)は、そのラボを埋め込んだレッスンのどれかを読了すると開く。どのレッスンにも埋め込まれないラボは最初から開く。

## 2.4 クイズ `js/data/quiz.js`
```js
ST.QUIZ = [
 {q:"設問文", a:["正解","誤答1","誤答2","誤答3"], term:"tls", exp:"解説。なぜそうかを1〜2文で。"},
];
```
- **`a[0]` が常に正解**。表示時に `order` を乱数でシャッフルする(UIが `i===0` で判定)。
- `term`(必須): 紐づく用語id。解答後に「用語を確認する」リンクと出典を出し、**誤答した用語ほど次回の出題で先に出る**(`ST.P.terms[term]` の c/w を更新)。
- `exp` 必須。check.js が term と exp の無い問題を落とす。
- 設問は断定が出典で言える内容のみ。「〜してよい?」型で、よくある誤解を正す問いが効果的(例: 鍵マークなら本物と判断してよい? → 判断できない)。

## 2.5 シミュレーター(攻撃シナリオ) `js/data/scenarios.js`
```js
ST.SCEN = [
 {id:"phishing", title:"スミッシングで不正送金", tag:"個人", terms:["phishing","smishing","passkey"],
  intro:"導入1〜2文",
  nodes:[{id:"atk",type:"attacker",label:"攻撃者",x:60,y:60}, ...],      // viewBox 360x230 程度の座標。type は app.js の i-* シンボル名
  links:[["atk","me"],["me","fake"],["atk","fake",1]],                   // 3番目が1なら点線(間接)
  defs:[{id:"official",label:"…する",d:"補足",term:"phishing"}],         // 防御をON/OFFする選択肢
  steps:[{f:"atk",t:"me",p:"SMS",title:"…",text:"…",
          block:"official", blockText:"防御ONのときここで止まる理由"}],  // block = この防御で止まる / mitig = 緩和のみ
  bad:"攻撃成功:…", good:"攻撃を阻止", mid:"被害の可能性が下がりました"}  // mid は mitig 用
];
ST.SC = Object.fromEntries(ST.SCEN.map(s => [s.id, s]));
```
- 別テーマでは「シナリオ分岐シミュレーター」に読み替える(例: 診察の流れで判断を変えると結果が変わる)。構造は **登場者(nodes)・やり取り(steps)・介入(defs)・介入すると途中で止まる(block)**。
- check.js が `terms` と本文中の `[[用語]]` の未登録を検出。
- 描画は `js/widgets/packetsim.js`(group 無しのウィジェット = ラボ一覧に出さない)。

## 2.6 ニュース `js/data/news.js`
```js
ST.NEWS_STATIC = [   // 新しい順
 {id:"jpcert-at260034", date:"2026-10-26", org:"JPCERT/CC", severity:"注意"|"緊急"|"情報",
  title:"…", url:"一次情報のURL", summary:"1〜2文", points:["対策: …","対象: …"], terms:["patch","vulnerability"],
  verifiedAt:"2026-11-03"}   // 実際に開いて確認した日
];
```
- 一次情報(公的機関の公式発表)だけ。`url` はタイトルのリンク先。`verifiedAt` は確認日。
- 週次更新(月曜)で追記PR。新規が無ければ何もしない。
- 別テーマでは「最新動向」にあたる(制度改正、ガイドライン更新、新規リリースなど)。更新頻度が遅い分野ならニュース画面は省略可。画面下の「公式の情報源」リンク集(views.js の OFFICIAL)は差し替える。

## 2.7 ウィジェット(図解ラボ) `js/widgets/*.js`
```js
(function (ST) {
  const esc = ST.esc;
  ST.widget("arp", {
    title: "ベンチ枠の見出し",
    group: "net", name: "ラボ一覧の名前", desc: "一覧の説明1行", order: 4,   // group があるものだけラボ一覧に載る
    motion: true,                                                           // 任意。「動き」切り替えを出す
    mount(el, opts) {
      el.innerHTML = `...`;      // 操作UI(toggle、btn、seg)+ 図(svg)+ 結果欄(aria-live)
      ...
      return () => { /* タイマー停止などの後始末 */ };   // 必須の習慣
    }
  });
})(window.ST);
```
- 枠(LEDつきヘッダ、LABチップ、動き切り替え)は `ST.mountWidget` が付ける。ウィジェットは中身だけ。
- 共通部品 `_kit.js`: `ST.seq(el,{actors,steps,intro,outro})` シーケンス図+「次へ/再生」、`ST.segHtml/wireSeg` 切り替えボタン、`ST.lineChart`、`ST.flyPacket(svg,points,{label,color,blockAt})` 動くパケット(`blockAt` で途中停止)、`ST.hex`、`ST.sha256`。
- ラボの設計原則: **架空のデータだけ**を使い、実際の通信・実行はしない。トグル(防御/対策のON/OFF)を切り替えると結果が変わり、変化の理由を言葉で出す。結果欄は `aria-live="polite"`。本物の仕組みが再現できるときは本物を使う(SHA-256 は Web Crypto、SQL は同梱 sql.js)。
- 別テーマの置き換え例: 語学 → 活用変化の可視化、会計 → 仕訳が勘定残高に流れる図、医療 → 検査値と判定の閾値スライダー。共通する型は「入力を動かす → 内部の流れを図で見る → 結果と理由を文で読む」。

## 2.8 注意枠 (js/redline.js / js/data/legal.js)
このテーマ固有(「どこからが違法か」)。流用するなら「この分野でやってはいけない線・免責」を同じ形で出す。核は **`unconfirmed:true` を付けて「要確認」と画面に出す**ルール(条番号・罰則を一次情報で確認できなかったら、断定せず未確認を明示)。
