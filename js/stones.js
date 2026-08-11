/* =========================================================
   stones.js — 石のデータと、石のドット絵をその場で描く処理
   ・石はぜんぶ「種(seed)」から作るので、同じ石でも一つ一つ見た目がちがう
   ・画像ファイルは使わない
   ========================================================= */

import { rng, noise2, fbm, hashInt, hex2rgb, mixc, scaleRGB, makeCv, Buf, clamp, lerp } from './pixel.js';

/* ---------------------------------------------------------
   石ずかん（40しゅるい）
   pal = [くらい, ふつう, あかるい, アクセント]
   trans = ひかりの とおりやすさ / gloss = みがいたときの つや
   --------------------------------------------------------- */
export const STONES = [
  { id:'chert', name:'ちゃーと', kanji:'チャート', rarity:1, pattern:'plain', shape:'pebble',
    pal:['#6a6255','#8b8172','#a8a091','#565046'], trans:.03, glow:'#cfc7b6', gloss:.35,
    desc:'川原で いちばん よく 見かける かたい石。むかしの 海の 小さな 生きものが つみ重なって できた。',
    light:'ひかりは とおらない。ずっしりと 黒い かげ。' },

  { id:'granite', name:'かこうがん', kanji:'花崗岩', rarity:1, pattern:'speckle', shape:'pebble',
    pal:['#8c8177','#b5aca2','#dbd5cb','#413c3a'], trans:.05, glow:'#e8e0d4', gloss:.45,
    desc:'白と 黒の つぶつぶが 集まった石。地下で ゆっくり ひえた マグマの あかし。',
    light:'つぶの すきまだけが ほんのり 明るい。' },

  { id:'sandstone', name:'さがん', kanji:'砂岩', rarity:1, pattern:'layer', shape:'pebble',
    pal:['#a98a63','#c8ab84','#e4cca6','#8a6c48'], trans:.08, glow:'#f0dcb8', gloss:.3,
    desc:'砂が おしかたまって できた石。指で こすると ざらざら する。',
    light:'しま模様が うっすら すけて 見える。' },

  { id:'mudstone', name:'でいがん', kanji:'泥岩', rarity:1, pattern:'plain', shape:'flat',
    pal:['#5d5b58','#767370','#918e89','#4a4846'], trans:.02, glow:'#b9b6b0', gloss:.3,
    desc:'どろが かたまった石。わると まっすぐ 平らに 割れる。',
    light:'ひかりを ぜんぶ すいこんでしまう。' },

  { id:'limestone', name:'せっかいがん', kanji:'石灰岩', rarity:1, pattern:'mottle', shape:'pebble',
    pal:['#a8a08c','#c9c2ae','#e9e4d4','#8d8574'], trans:.12, glow:'#f4efdc', gloss:.4,
    desc:'サンゴや 貝の からで できた石。うすい 酢を かけると あわが 出る。',
    light:'ふちが ほんのり 白く 光る。' },

  { id:'basalt', name:'げんぶがん', kanji:'玄武岩', rarity:1, pattern:'bubble', shape:'pebble',
    pal:['#3f3f44','#55555c','#6e6e77','#2b2b30'], trans:.03, glow:'#9a9aa4', gloss:.4,
    desc:'火山から 流れた ようがんが ひえた石。小さな 穴は あわの あと。',
    light:'穴の ところだけ すこし 明るい。' },

  { id:'quartzite', name:'せきえいがん', kanji:'石英岩', rarity:2, pattern:'sugar', shape:'pebble',
    pal:['#b2ada3','#d0ccc4','#ebe9e3','#96918a'], trans:.28, glow:'#ffffff', gloss:.7,
    desc:'砂岩が 熱と 力で かたく なった石。お砂糖の かたまりみたい。',
    light:'ざらざらの つぶが ちりちりと きらめく。' },

  { id:'jasper', name:'へきぎょく', kanji:'碧玉', rarity:2, pattern:'mottle', shape:'pebble',
    pal:['#8c3a2c','#b25642','#d1755c','#5e2a20'], trans:.08, glow:'#ff9c7a', gloss:.85,
    desc:'あざやかな 赤の 玉。むかしは はんこや かざりに つかわれた。',
    light:'ふちが ほんのり 赤く にじむ。' },

  { id:'mica', name:'うんも', kanji:'雲母', rarity:2, pattern:'flake', shape:'flat',
    pal:['#7e7359','#a89d80','#d2c8ac','#f4ebca'], trans:.45, glow:'#fff3c8', gloss:.95,
    desc:'うすい 紙のように はがれる石。かさねると きらきら 光る。',
    light:'うすい ところが 金色に すける。' },

  { id:'marble', name:'だいりせき', kanji:'大理石', rarity:2, pattern:'vein', shape:'pebble',
    pal:['#bbb5aa','#dad5cd','#f0ede7','#8b8477'], trans:.32, glow:'#fffdf6', gloss:.85,
    desc:'石灰岩が 生まれ変わった 白い石。すじ模様が 川の ながれのよう。',
    light:'白い ところが ふんわり 明るく なる。' },

  { id:'seaglass', name:'うみのがらす', kanji:'海硝子', rarity:2, pattern:'frost', shape:'flat',
    pal:['#7fae9a','#a8cdbb','#d2e8dc','#eef7f1'], trans:.75, glow:'#d8fff0', gloss:.5,
    desc:'なみに もまれた ガラスの かけら。とがった ところは もう ない。',
    light:'すりガラスの ように やわらかく すける。' },

  { id:'chalcedony', name:'ぎょくずい', kanji:'玉髄', rarity:3, pattern:'plain', shape:'round',
    pal:['#a69e92','#c8c1b5','#e4ded2','#908880'], trans:.62, glow:'#fff4e2', gloss:.9,
    desc:'めのうの なかまで、模様の ない すべすべの石。ミルクを かためたよう。',
    light:'ろうそくの ように ほのかに すける。' },

  { id:'agate', name:'めのう', kanji:'瑪瑙', rarity:3, pattern:'band', shape:'pebble',
    pal:['#a6785a','#cf9f78','#f0d8b6','#7d5540'], trans:.5, glow:'#ffd9a8', gloss:.9,
    desc:'しま模様が とじこめられた石。ひとつずつ 模様が ちがうので 見あきない。',
    light:'しまの あいだから あたたかい 色が すける。' },

  { id:'crystal', name:'すいしょう', kanji:'水晶', rarity:3, pattern:'facet', shape:'angular',
    pal:['#a6c0cb','#c8dde5','#e8f3f8','#8ba4af'], trans:.92, glow:'#dff4ff', gloss:1,
    desc:'六角の はしらに そだつ すきとおった石。氷みたいだけど つめたくない。',
    light:'むこうが すける。ふちに 小さな 虹が うまれた。' },

  { id:'smoky', name:'けむりすいしょう', kanji:'煙水晶', rarity:3, pattern:'facet', shape:'angular',
    pal:['#6b5d52','#8e7d6f','#b8a798','#4e433a'], trans:.7, glow:'#e0c9ae', gloss:1,
    desc:'けむりを とじこめたような 水晶。地面の 中で ゆっくり 色が ついた。',
    light:'茶色の けむりが ゆらいで 見える。' },

  { id:'rosequartz', name:'ばらすいしょう', kanji:'薔薇水晶', rarity:3, pattern:'plain', shape:'round',
    pal:['#d9a3a8','#eec3c6','#fce1e3','#b7838a'], trans:.6, glow:'#ffd9dd', gloss:.85,
    desc:'やさしい 桃色の 水晶。もやもやした 中身が かわいい。',
    light:'もやが ほんのり 桜色に 光る。' },

  { id:'serpentine', name:'じゃもんがん', kanji:'蛇紋岩', rarity:3, pattern:'vein', shape:'pebble',
    pal:['#4e6b4f','#6d8b66','#9db58e','#2f4433'], trans:.2, glow:'#b8ffbe', gloss:.75,
    desc:'へびの はだのような 模様の 緑の石。さわると ぬるっと つやが ある。',
    light:'緑の すじが うすく すける。' },

  { id:'obsidian', name:'こくようせき', kanji:'黒曜石', rarity:3, pattern:'glass', shape:'shard',
    pal:['#1e1c22','#2f2c34','#4d4856','#0f0e12'], trans:.35, glow:'#7a5540', gloss:1,
    desc:'ガラスに なった ようがん。われた ふちは かみそりより するどい。',
    light:'うすい ところが こっくりと 茶色に すける。' },

  { id:'pyrite', name:'おうてっこう', kanji:'黄鉄鉱', rarity:3, pattern:'metal', shape:'angular',
    pal:['#a58b3c','#d8bb56','#f4e08a','#6f5b23'], trans:0, glow:'#fff0a8', gloss:1,
    desc:'四角い つぶが きちんと ならんだ 金いろの石。「ばか金」とも よばれた。',
    light:'まったく すけない。かわりに 表面が ぴかっと はねかえす。' },

  { id:'calcite', name:'ほうかいせき', kanji:'方解石', rarity:3, pattern:'facet', shape:'angular',
    pal:['#b4ac9a','#d2cbb8','#eee8da','#948b79'], trans:.85, glow:'#fffbe8', gloss:.95,
    desc:'ななめの 箱の かたちに 割れる石。むこうの 線が 二重に 見える。',
    light:'かざした 文字が 二つに 見える ふしぎ。' },

  { id:'mossagate', name:'こけめのう', kanji:'苔瑪瑙', rarity:4, pattern:'moss', shape:'round',
    pal:['#a9a494','#c8c3b3','#e4e0cf','#3f6b3d'], trans:.7, glow:'#eaffdc', gloss:.9,
    desc:'石の中に 小さな 森が ある。苔に 見えるのは 鉄や マンガンの もよう。',
    light:'みどりの 枝が くっきりと 浮かびあがった。' },

  { id:'amethyst', name:'むらさきすいしょう', kanji:'紫水晶', rarity:4, pattern:'facet', shape:'angular',
    pal:['#7a5c96','#a37fbe','#cfb2e2','#553d6d'], trans:.8, glow:'#dcc0ff', gloss:1,
    desc:'むらさきの 水晶。先の ほうだけ 色が こい ものが 多い。',
    light:'ぶどうジュースの ような むらさきが 広がる。' },

  { id:'citrine', name:'きいろすいしょう', kanji:'黄水晶', rarity:4, pattern:'facet', shape:'angular',
    pal:['#b98a2e','#dfb04f','#f7dc94','#8e6620'], trans:.82, glow:'#ffe9a8', gloss:1,
    desc:'はちみつ色の 水晶。日なたに おくと あたたかそうに 見える。',
    light:'金いろの ひかりが とけて あふれだす。' },

  { id:'malachite', name:'くじゃくいし', kanji:'孔雀石', rarity:4, pattern:'band', shape:'round',
    pal:['#1f5c46','#2f8a63','#74c299','#0f3b2c'], trans:.1, glow:'#8affc4', gloss:.95,
    desc:'くじゃくの 羽のような 緑の しま模様。銅から 生まれた石。',
    light:'すけないけれど しまが つやつやと ながれる。' },

  { id:'turquoise', name:'とるこいし', kanji:'トルコ石', rarity:4, pattern:'web', shape:'pebble',
    pal:['#3d9aa8','#63bfc9','#a2e2e6','#5b4a3a'], trans:.12, glow:'#b8fbff', gloss:.7,
    desc:'空の色を 分けてもらった ような石。黒い すじは まわりの 岩。',
    light:'うっすら 青が にじむ。' },

  { id:'tourmaline', name:'でんきいし', kanji:'電気石', rarity:4, pattern:'bicolor', shape:'column',
    pal:['#8f3f5f','#3f7f52','#d78ba4','#8fd0a0'], trans:.7, glow:'#ffd0e0', gloss:1,
    desc:'ひとつの はしらで 色が 二つ。あたためると 電気を おびる。',
    light:'赤と 緑の さかいめが すっと 見えた。' },

  { id:'garnet', name:'ざくろいし', kanji:'柘榴石', rarity:4, pattern:'facet', shape:'angular',
    pal:['#6d1f22','#9c3030','#d16256','#4a1215'], trans:.55, glow:'#ff9a86', gloss:1,
    desc:'ざくろの つぶに にた 深い赤。丸っこい 十二面の かたちで そだつ。',
    light:'ぶあつい ワインの ような 赤が すける。' },

  { id:'peridot', name:'かんらんせき', kanji:'橄欖石', rarity:4, pattern:'grain', shape:'round',
    pal:['#6f8b32','#9cb84a','#cde286','#4d6322'], trans:.7, glow:'#e6ffa8', gloss:.95,
    desc:'オリーブ色の つぶつぶ。地球の ずっと 深い ところから 来た。',
    light:'若葉の ような みどりが 透ける。' },

  { id:'fluorite', name:'ほたるいし', kanji:'蛍石', rarity:4, pattern:'facet', shape:'angular',
    pal:['#4f7f8f','#77a8b0','#b6d8d8','#8a6fa8'], trans:.88, glow:'#b8ffe8', gloss:.95,
    desc:'あたためると ぽうっと 光る石。緑や むらさきが かさなって 見える。',
    light:'色が おびに なって かさなって 見える。' },

  { id:'petrifiedwood', name:'けいかぼく', kanji:'珪化木', rarity:4, pattern:'wood', shape:'flat',
    pal:['#6b4a30','#94693f','#c69d66','#3f2a1a'], trans:.25, glow:'#ffcb8a', gloss:.8,
    desc:'木が 石に 変わった もの。年輪も 木目も そのまま のこっている。',
    light:'年輪の あいだが ほんのり あかるい。' },

  { id:'lapis', name:'るりいし', kanji:'瑠璃', rarity:5, pattern:'lapis', shape:'pebble',
    pal:['#1e3f8f','#2f56b8','#6b8ede','#e0c46a'], trans:.1, glow:'#8ab0ff', gloss:.9,
    desc:'夜空を 切りとった ような 青。金の つぶは 黄鉄鉱。',
    light:'すけないのに 深い。星空を 見て いるみたい。' },

  { id:'jade', name:'ひすい', kanji:'翡翠', rarity:5, pattern:'plain', shape:'round',
    pal:['#4f8f6d','#79b48c','#b6dabd','#2f6b4f'], trans:.6, glow:'#c8ffd8', gloss:.95,
    desc:'かたくて ねばりづよい 緑の石。日本では 五千年 まえから たいせつに されてきた。',
    light:'あわい みどりが しっとりと すける。' },

  { id:'moonstone', name:'つきのいし', kanji:'月長石', rarity:5, pattern:'sheen', shape:'round',
    pal:['#a3acb8','#c6d0da','#e6ecf2','#8ec8f0'], trans:.8, glow:'#dff0ff', gloss:1,
    desc:'かたむけると 青い ひかりが すーっと わたる。月の あかりの ような石。',
    light:'うちがわで 青い 波が ゆっくり ゆれた。' },

  { id:'opal', name:'にじいし', kanji:'蛋白石', rarity:5, pattern:'opal', shape:'pebble',
    pal:['#c2bcb6','#ded8d2','#f2eeea','#78bcec'], trans:.7, glow:'#fff0d8', gloss:1,
    desc:'うごかすと 虹が 走る。水を たっぷり ふくんだ ふしぎな石。',
    light:'赤 みどり 青、いろんな 色が いちどに ともった。' },

  { id:'amber', name:'こはく', kanji:'琥珀', rarity:5, pattern:'amber', shape:'pebble',
    pal:['#a35d16','#d18b2c','#f4c06a','#6e3a0c'], trans:.85, glow:'#ffd48a', gloss:1,
    desc:'木の やにが 何千万年 かけて かたまった もの。石より かるくて あたたかい。',
    light:'あめ色に すけて…小さな 虫が 入っている！' },

  { id:'ammonite', name:'うずまきいし', kanji:'アンモナイト', rarity:5, pattern:'fossil', shape:'round',
    pal:['#7a6a52','#a08b6b','#cab48c','#4a3e30'], trans:.15, glow:'#e8d0a0', gloss:.8,
    desc:'うずまきの からを もつ 生きものの 化石。ずっと むかしの 海の 記おく。',
    light:'うずの すじが 影に なって うかびあがる。' },

  { id:'geode', name:'きしょう', kanji:'晶洞', rarity:5, pattern:'geode', shape:'round',
    pal:['#8d8272','#aaa08e','#c9c0b1','#d8f2fb'], trans:.14, glow:'#dff6ff', gloss:.5,
    desc:'ただの 丸い石…と 思ったら、なかは 水晶の へやに なっていた。',
    light:'なかに 空どうが ある！ 小さな 水晶が ずらりと ならんでいる。' },

  { id:'arrowhead', name:'やじり', kanji:'石鏃', rarity:5, pattern:'knap', shape:'shard',
    pal:['#3a3a42','#4f4f59','#70707c','#26262c'], trans:.3, glow:'#8a6a52', gloss:.9,
    desc:'だれかが 手で けずった 矢の さき。何千年 まえの しごとの あと。',
    light:'うすい ふちが ぼんやりと すける。' },

  { id:'meteorite', name:'ほしのかけら', kanji:'隕石', rarity:5, pattern:'pit', shape:'pebble',
    pal:['#3b3630','#544d44','#7d7469','#bcb5a9'], trans:.02, glow:'#c8d8e8', gloss:.9,
    desc:'空から おちてきた 鉄の かたまり。ずっしり 重くて、磁石が くっつく。',
    light:'すけない。でも 表面の きずが 銀色に 光る。' },

  { id:'heartstone', name:'ハートのいし', kanji:'', rarity:4, pattern:'plain', shape:'heart',
    pal:['#c9848f','#e2a8ad','#f7d4d6','#a86a76'], trans:.4, glow:'#ffd8dc', gloss:.9,
    desc:'ぐうぜん ハートの かたちに なった石。だれかに あげたく なる。',
    light:'まんなかが ぽっと あかるく なった。' },
];

export const STONE_BY_ID = Object.fromEntries(STONES.map(s => [s.id, s]));
export const TOTAL_STONES = STONES.length;

/* ---------------------------------------------------------
   ばしょ（フィールド）
   need = ずかんの はっけん数が これ以上で 開放
   --------------------------------------------------------- */
export const FIELDS = [
  { id:'kawara', name:'はじまりの かわら', short:'かわら', need:0, scene:'river',
    note:'あさい 川の 石ころだらけの 岸。',
    table:[['chert',22],['granite',18],['sandstone',16],['mudstone',12],['limestone',12],
           ['quartzite',9],['marble',7],['mica',6],['agate',5],['jasper',5],
           ['rosequartz',3],['crystal',3],['heartstone',1]] },

  { id:'keiryu', name:'すずしい けいりゅう', short:'けいりゅう', need:7, scene:'stream',
    note:'こけの においが する 上流の 沢。',
    table:[['chert',14],['granite',12],['quartzite',10],['agate',10],['chalcedony',9],
           ['serpentine',9],['smoky',8],['amethyst',6],['peridot',6],['mossagate',5],
           ['pyrite',5],['mica',5],['jade',2],['heartstone',1]] },

  { id:'hamabe', name:'しおかぜの はまべ', short:'はまべ', need:13, scene:'beach',
    note:'なみが 石を ころころ みがいていく。',
    table:[['limestone',16],['sandstone',14],['seaglass',13],['chalcedony',10],['chert',9],
           ['marble',8],['agate',7],['petrifiedwood',6],['ammonite',5],['moonstone',4],
           ['opal',2],['heartstone',2]] },

  { id:'iwayama', name:'かぜの いわやま', short:'いわやま', need:19, scene:'mountain',
    note:'ごろごろした 岩の あいだの 細い道。',
    table:[['basalt',16],['granite',12],['obsidian',11],['jasper',10],['garnet',8],
           ['citrine',8],['malachite',7],['turquoise',7],['tourmaline',6],['pyrite',6],
           ['smoky',5],['arrowhead',3],['meteorite',1]] },

  { id:'doukutsu', name:'しずかな しょうにゅうどう', short:'どうくつ', need:26, scene:'cave',
    note:'水の おちる 音だけが ひびく 泉。',
    table:[['calcite',16],['limestone',12],['marble',11],['fluorite',10],['amethyst',9],
           ['quartzite',9],['geode',7],['crystal',7],['lapis',5],['chalcedony',5],
           ['mossagate',4],['jade',3]] },

  { id:'yozora', name:'よぞらの みずうみ', short:'みずうみ', need:33, scene:'night',
    note:'星が うつる 湖の ふち。ふしぎな 石が ねている。',
    table:[['moonstone',13],['opal',11],['amber',10],['lapis',10],['jade',9],['geode',8],
           ['crystal',8],['fluorite',7],['garnet',6],['meteorite',5],['ammonite',5],
           ['arrowhead',4],['heartstone',3]] },
];
export const FIELD_BY_ID = Object.fromEntries(FIELDS.map(f => [f.id, f]));

/* ---------------------------------------------------------
   みつけもの（石じゃない ひろいもの。たなの かざりに つかえる）
   --------------------------------------------------------- */
export const FINDS = [
  { id:'leaf',   name:'はっぱ',        ic:'🍃', desc:'ふちが きれいな 一まい。' },
  { id:'feather',name:'とりのはね',    ic:'🪶', desc:'かるくて ふわり。' },
  { id:'acorn',  name:'どんぐり',      ic:'🌰', desc:'ぼうしを かぶっている。' },
  { id:'cone',   name:'まつぼっくり',  ic:'🌲', desc:'かわくと ひらく。' },
  { id:'petal',  name:'はなびら',      ic:'🌸', desc:'どこから 来たのだろう。' },
  { id:'shell',  name:'ちいさなかい',  ic:'🐚', desc:'耳に あてると 波の音。' },
  { id:'wood',   name:'りゅうぼく',    ic:'🪵', desc:'なめらかに なった 枝。' },
  { id:'star',   name:'ながれぼしのかけら', ic:'💫', desc:'たぶん 気のせい。でも あたたかい。' },
  { id:'firefly',name:'ほたるのひかり', ic:'✨', desc:'にぎると ゆっくり 消えた。' },
  { id:'snow',   name:'ゆきのけっしょう', ic:'❄️', desc:'とけないように そっと。' },
];
export const FIND_BY_ID = Object.fromEntries(FINDS.map(f => [f.id, f]));

/* =========================================================
   ここから 絵を 描く 処理
   ========================================================= */

const LIGHT_DIR = (() => {
  const v = [-0.42, -0.58, 0.70];
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

function hsl2rgb(h, s, l){
  h = ((h % 360) + 360) % 360 / 360;
  const f = n => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const h01 = (x, y, s) => hashInt(x, y, s) / 4294967296;

/* ---------- かたち: 角度ごとの はんけい ---------- */
function shapeRadius(shape, seed){
  const r = rng(seed * 7 + 13);
  const j = [], N = 7;
  for (let i = 0; i < N; i++) j.push(.82 + r() * .3);
  const off = r() * Math.PI * 2;

  const poly = (n, rot) => a => {
    const step = Math.PI * 2 / n;
    const k = ((a - rot) % step + step) % step;
    return Math.cos(Math.PI / n) / Math.cos(k - Math.PI / n);
  };

  switch (shape){
    case 'round':
      return a => .95 + .05 * noise2(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5, seed);
    case 'flat':
      return a => {
        const e = 1 / Math.hypot(Math.cos(a) / 1, Math.sin(a) / .58);
        return e * (.9 + .1 * noise2(Math.cos(a) * 3 + 2, Math.sin(a) * 3 + 2, seed));
      };
    case 'angular': {
      const p = poly(6, off);
      return a => {
        const step = Math.PI * 2 / 6;
        const idx = Math.floor(((a - off) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) / step);
        return p(a) * (.9 + .16 * j[idx % N]) * .96;
      };
    }
    case 'shard': {
      const p = poly(3, off);
      return a => p(a) * (1 / Math.hypot(Math.cos(a) / .8, Math.sin(a) / 1.05)) * 1.05;
    }
    case 'column':
      return a => 1 / Math.pow(Math.pow(Math.abs(Math.cos(a) / .52), 7) +
                               Math.pow(Math.abs(Math.sin(a) / .98), 7), 1 / 7);
    case 'heart':
      return a => {
        // (x²+y²-1)³ - x²y³ ≤ 0 を 光線に そって さがす
        const cx = Math.cos(a), cy = -Math.sin(a);
        const inside = t => {
          const x = cx * t * 1.32, y = cy * t * 1.22 + .22;
          const q = x * x + y * y - 1;
          return q * q * q - x * x * y * y * y <= 0;
        };
        let lo = 0, hi = 1.8;
        for (let i = 0; i < 14; i++){ const m = (lo + hi) / 2; if (inside(m)) lo = m; else hi = m; }
        return lo * .96;
      };
    default: // pebble
      return a => {
        const n = fbm(Math.cos(a) * 1.6 + 4, Math.sin(a) * 1.6 + 4, seed, 3);
        return (.84 + n * .28) * (1 / Math.hypot(Math.cos(a) / 1, Math.sin(a) / .88));
      };
  }
}

/* ---------- 模様: 1ドットの 色を きめる ---------- */
function surfaceColor(def, u, v, rr, ix, iy, seed, mode, blobs){
  const P = def.pal;
  const lit = mode === 'light';
  const q = (t, n = 4) => Math.round(clamp(t, 0, 1) * (n - 1)) / (n - 1);
  const band3 = t => t < .34 ? P[0] : t < .68 ? P[1] : P[2];
  const nz = (fx, fy, s, o) => fbm(u * fx + 6, v * fy + 6, seed + (s || 0), o || 3);
  let c;

  switch (def.pattern){

    case 'speckle': {
      c = mixc(P[1], P[2], q(nz(3.2, 3.2)));
      const h = h01(ix, iy, seed);
      if (h < .11) c = hex2rgb(P[3]);
      else if (h < .18) c = mixc(P[2], '#ffffff', .55);
      else if (h < .215) c = mixc(P[2], '#d8a89a', .7);
      break;
    }

    case 'layer': {
      const t = (v + 1) * 2.6 + u * .5 + nz(2.4, 5, 3) * 1.1;
      const k = Math.floor(t * 2) % 3;
      c = hex2rgb(k === 0 ? P[0] : k === 1 ? P[1] : P[2]);
      if (h01(ix, iy, seed + 9) < .09) c = mixc(c, '#ffffff', .35);
      break;
    }

    case 'mottle': {
      const t = nz(2.4, 2.4, 0, 4);
      c = mixc(P[0], P[2], q(t, 5));
      if (t > .74) c = mixc(P[2], '#ffffff', .3);
      if (t < .24) c = hex2rgb(P[3]);
      break;
    }

    case 'bubble': {
      c = mixc(P[0], P[1], q(nz(3, 3)));
      for (const b of blobs){
        const d = Math.hypot(u - b.x, v - b.y);
        if (d < b.r){
          c = d > b.r * .62 ? mixc(P[2], '#ffffff', lit ? .5 : .1) : hex2rgb(P[3]);
          break;
        }
      }
      break;
    }

    case 'wood': {   // 年輪と 木目
      const d = Math.hypot(u * 1.15, v * .75) + nz(2, 2) * .3;
      const ring = (Math.sin(d * 17) + 1) / 2;
      c = mixc(P[0], P[2], q(ring, 4));
      if (ring > .88) c = mixc(P[2], '#ffffff', .3);
      if (ring < .1) c = hex2rgb(P[3]);
      // たての 木目
      const grain = ((v * 5 + nz(3, 1.2) * 2) % 1 + 1) % 1;
      if (grain < .1) c = mixc(c, P[3], .45);
      break;
    }

    case 'frost': {  // すりガラス
      c = mixc(P[1], P[2], q(nz(2.6, 2.6), 4));
      const hh = h01(ix, iy, seed);
      if (hh < .26) c = mixc(P[3], '#ffffff', .35);
      else if (hh < .34) c = hex2rgb(P[0]);
      // かどの すりへった 感じ
      if (rr > .82 && hh < .5) c = mixc(c, '#ffffff', .3);
      break;
    }

    case 'sugar': {
      c = mixc(P[1], P[2], q(nz(4, 4)));
      const h = h01(ix, iy, seed);
      if (h < .2) c = mixc(P[2], '#ffffff', .8);
      else if (h < .3) c = hex2rgb(P[0]);
      break;
    }

    case 'flake': {
      const t = (v * 4.5 + nz(1.5, 1.5) * 2.2);
      const k = ((t % 1) + 1) % 1;
      c = k < .12 ? mixc(P[3], '#ffffff', .5) : mixc(P[0], P[2], q(k, 4));
      break;
    }

    case 'vein': {
      const n1 = nz(2.6, 2.6, 0, 4);
      const ridge = Math.abs(n1 - .5);
      if (ridge < .05) c = hex2rgb(P[3]);
      else if (ridge < .075) c = mixc(P[3], P[1], .6);
      else c = mixc(P[1], P[2], q(nz(4.5, 4.5, 71, 2)));
      break;
    }

    case 'band': {
      const w = nz(2.1, 2.1, 0, 3) - .5;
      const d = Math.hypot(u * 1.0, v * 1.45) + w * .55;
      const b = (Math.sin(d * 11.5 + 1.1) + 1) / 2;
      c = mixc(P[0], P[2], q(b, 4));
      if (b > .93) c = mixc(P[2], '#ffffff', .5);
      if (b < .07) c = hex2rgb(P[3]);
      break;
    }

    case 'facet': {
      const a = Math.atan2(v, u);
      const K = 5;
      const s = Math.floor((a + Math.PI) / (Math.PI * 2) * K);
      const f = .2 + (hashInt(s, 3, seed) % 100) / 100 * .6;
      const streak = Math.round(nz(6, 1.4) * 3) / 3;
      c = mixc(P[0], P[2], clamp(f * .7 + streak * .28, 0, 1));
      // 面の さかいめ
      const frac = ((a + Math.PI) / (Math.PI * 2) * K) % 1;
      if (frac < .06) c = mixc(c, '#ffffff', .35);
      break;
    }

    case 'glass': {
      const t = nz(2.2, 2.2, 0, 3);
      c = mixc(P[0], P[1], q(t, 3));
      if (t > .78) c = hex2rgb(P[2]);
      break;
    }

    case 'metal': {
      const G = .34;
      const gx = Math.floor((u + 1) / G), gy = Math.floor((v + 1) / G);
      const f = .78 + h01(gx, gy, seed) * .44;
      c = scaleRGB(P[1], f);
      const fx = ((u + 1) / G) % 1, fy = ((v + 1) / G) % 1;
      if (fx < .13 || fy < .13) c = hex2rgb(P[3]);
      else if (fx > .84 || fy > .84) c = hex2rgb(P[2]);
      break;
    }

    case 'grain': {
      const G = .27;
      const gx = Math.floor((u + 1) / G), gy = Math.floor((v + 1) / G);
      const f = h01(gx, gy, seed);
      c = mixc(P[0], P[2], q(f, 4));
      const fx = ((u + 1) / G) % 1, fy = ((v + 1) / G) % 1;
      if (fx < .1 || fy < .1) c = mixc(c, P[3], .5);
      break;
    }

    case 'web': {
      const n1 = nz(2.8, 2.8, 0, 4);
      const ridge = Math.abs(n1 - .5);
      c = mixc(P[1], P[2], q(nz(4, 4, 41, 2)));
      if (ridge < .045) c = hex2rgb(P[3]);
      break;
    }

    case 'bicolor': {
      const cut = .12 + (nz(3, .6) - .5) * .25;
      const top = v < cut;
      c = top ? mixc(P[0], P[2], q(nz(5, 1.6), 3)) : mixc(P[1], P[3], q(nz(5, 1.6, 17), 3));
      if (Math.abs(v - cut) < .05) c = mixc(c, '#ffffff', .35);
      // たての すじ
      if (Math.round(nz(7, .5, 5) * 4) % 2 === 0) c = scaleRGB(c, .92);
      break;
    }

    case 'sheen': {
      c = mixc(P[1], P[2], q(nz(3, 3), 4));
      const band = Math.exp(-Math.pow((u * .72 + v * .70 + .05) / .30, 2));
      c = mixc(c, P[3], band * (lit ? .85 : .6));
      break;
    }

    case 'opal': {
      const G = .3;
      const gx = Math.floor((u + 1) / G + h01(0, Math.floor((v + 1) / G), seed) * 2);
      const gy = Math.floor((v + 1) / G);
      const hue = h01(gx, gy, seed) * 360;
      const iri = hsl2rgb(hue, .75, lit ? .68 : .78);
      c = mixc(P[1], '#ffffff', .2);
      const m = .35 + h01(gx, gy, seed + 5) * .4;
      c = [lerp(c[0], iri[0], m), lerp(c[1], iri[1], m), lerp(c[2], iri[2], m)];
      break;
    }

    case 'lapis': {
      const t = nz(2.6, 2.6, 0, 4);
      c = mixc(P[0], P[1], q(t, 4));
      if (t > .78) c = hex2rgb(P[2]);
      if (t < .18) c = mixc(P[0], '#ffffff', .3);          // 白い方ソーダ石
      if (h01(ix, iy, seed + 3) < .04) c = hex2rgb(P[3]);   // 金の つぶ
      break;
    }

    case 'moss': {
      c = mixc(P[1], P[2], q(nz(3, 3), 4));
      const wx = u * 2.4 + fbm(u * 3 + 1, v * 3 + 1, seed + 2, 3) * 1.6;
      const wy = v * 2.4 + fbm(u * 3 + 9, v * 3 + 9, seed + 4, 3) * 1.6;
      const fil = Math.abs(noise2(wx * 1.8, wy * 1.8, seed + 6) - .5);
      const near = clamp(1.2 - Math.hypot(u, v), 0, 1);
      if (fil < .10 * near * (lit ? 1.4 : 1)) c = mixc(P[3], lit ? '#5f9a52' : '#33512f', lit ? .3 : .25);
      else if (fil < .15 * near) c = mixc(c, P[3], .35);
      break;
    }

    case 'amber': {
      c = mixc(P[0], P[2], q(nz(2.2, 2.2), 5));
      // 中の 虫（かざすと よく 見える）
      const bx = u - .05, by = v - .02;
      const body = Math.hypot(bx / .17, by / .30) < 1;
      const head = Math.hypot(bx / .12, (by + .34) / .12) < 1;
      let leg = false;
      for (let i = -1; i <= 1; i++){
        const ly = by - i * .14;
        if (Math.abs(ly) < .05 && Math.abs(bx) < .38 && Math.abs(bx) > .13) leg = true;
      }
      if (body || head || leg) c = mixc(c, P[3], lit ? .92 : .5);
      break;
    }

    case 'fossil': {
      const a = Math.atan2(v, u);
      const rn = Math.hypot(u, v);
      c = mixc(P[1], P[2], q(nz(3, 3), 4));
      if (rn > .07){
        const sp = Math.log(rn) * 2.5 - a / (Math.PI * 2);
        const f = ((sp % 1) + 1) % 1;
        if (f < .1) c = hex2rgb(P[3]);                       // うずの すじ
        else c = mixc(P[0], P[2], q(f, 4));
        // 肋（あばら）
        const rib = ((a * 9 / Math.PI) % 1 + 1) % 1;
        if (rib < .22) c = mixc(c, P[3], .3);
      } else c = hex2rgb(P[3]);
      break;
    }

    case 'geode': {
      const rn = Math.hypot(u, v);
      const RC = .58;
      c = mixc(P[1], P[2], q(nz(3.4, 3.4), 4));
      if (h01(ix, iy, seed) < .1) c = hex2rgb(P[0]);
      if (lit && rn < RC){
        const a = Math.atan2(v, u);
        const K = 18;
        const tt = (a + Math.PI) / (Math.PI * 2) * K;
        const s = Math.floor(tt), frac = tt % 1;
        const len = .10 + h01(s, 1, seed) * .14;
        const taper = 1 - Math.abs(frac - .5) * 2;
        if (rn > RC - len * taper){
          // かべに ならぶ 小さな 水晶
          c = mixc(P[3], '#ffffff', .2 + taper * .35);
        } else {
          c = mixc('#2b3d47', P[3], .10 + (1 - rn / RC) * .12);   // 空どう
        }
      }
      break;
    }

    case 'knap': {
      const a = Math.atan2(v, u);
      const f = (((a * 3 / Math.PI) % 1) + 1) % 1;
      c = mixc(P[0], P[2], q(f, 3) * .85);
      if (f < .08) c = hex2rgb(P[3]);
      if (h01(ix, iy, seed) < .05) c = mixc(c, '#ffffff', .3);
      break;
    }

    case 'pit': {
      c = mixc(P[0], P[1], q(nz(3.2, 3.2), 4));
      for (const b of blobs){
        const d = Math.hypot(u - b.x, v - b.y);
        if (d < b.r){ c = mixc(P[0], '#000000', .35 * (1 - d / b.r)); break; }
      }
      if (h01(ix, iy, seed + 1) < .05) c = hex2rgb(P[3]);     // 金属の きらめき
      break;
    }

    default: { // plain
      const t = nz(3, 3, 0, 4);
      c = mixc(P[0], P[2], q(t, 5));
      if (t > .8) c = mixc(P[2], '#ffffff', .25);
      break;
    }
  }
  return c;
}

/* ---------- 石ひとつを 描く ---------- */
const cache = new Map();

export function renderStone(defOrId, seed = 1, S = 48, mode = 'normal', gloss = 1){
  const def = typeof defOrId === 'string' ? STONE_BY_ID[defOrId] : defOrId;
  if (!def) return makeCv(S, S).cv;
  const gq = Math.round(clamp(gloss, 0, 1) * 4) / 4;
  const key = def.id + '|' + seed + '|' + S + '|' + mode + '|' + gq;
  if (cache.has(key)) return cache.get(key);

  const buf = new Buf(S, S);
  const cx = (S - 1) / 2, cy = (S - 1) / 2;
  const R = S * .47;
  const radAt = shapeRadius(def.shape, seed);
  const lit = mode === 'light';

  // 泡・くぼみの もと
  const r0 = rng(seed * 31 + 7);
  const blobs = [];
  const nb = def.pattern === 'bubble' ? 12 : def.pattern === 'pit' ? 7 : 0;
  for (let i = 0; i < nb; i++)
    blobs.push({ x: (r0() - .5) * 1.5, y: (r0() - .5) * 1.5, r: .07 + r0() * .13 });

  const shininess = clamp((def.gloss ?? .5) * (.35 + .65 * clamp(gloss, 0, 1)), 0, 1);
  const trans = def.trans ?? .1;
  const glow = def.glow || '#ffffff';

  for (let y = 0; y < S; y++){
    for (let x = 0; x < S; x++){
      const u0 = (x + .5 - cx) / R, v0 = (y + .5 - cy) / R;
      const a = Math.atan2(v0, u0);
      const rad = radAt(a);
      const len = Math.hypot(u0, v0);
      const rr = len / rad;
      if (rr > 1) continue;

      const u = u0, v = v0;
      let c = surfaceColor(def, u / rad, v / rad, rr, x, y, seed, mode, blobs);

      /* かたち にそった かげ（球っぽく） */
      const h = Math.sqrt(Math.max(0, 1 - rr * rr)) * 1.15;
      const nl = Math.hypot(u / rad, v / rad, h) || 1;
      const nx = (u / rad) / nl, ny = (v / rad) / nl, nz = h / nl;
      let d = nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1] + nz * LIGHT_DIR[2];
      d = clamp(d, 0, 1);
      let sh = .58 + .62 * d;
      sh = Math.round(sh * 6) / 6;                       // 段々に して ドット絵らしく

      if (lit){
        // うしろから ひかり: あつい まんなかは 色が こく、うすい ふちは 明るく
        const thick = h / 1.15;              // 0(ふち)〜1(まんなか)
        const thin = 1 - thick;
        sh = sh * (1 - trans) + (.78 + thin * .36) * trans;
        c = mixc(c, glow, trans * thin * .34);
      }
      c = [c[0] * sh, c[1] * sh, c[2] * sh];

      /* てかり */
      const spec = Math.pow(clamp(d, 0, 1), 26) * shininess;
      if (spec > .04) c = mixc(c, '#ffffff', Math.min(.6, spec * .8));

      /* ふち */
      if (rr > .955){
        c = lit ? mixc(c, glow, .38) : [c[0] * .62, c[1] * .62, c[2] * .62];
      } else if (rr > .9 && d > .55){
        c = mixc(c, '#ffffff', .12);
      }

      buf.set(x, y, [c[0], c[1], c[2]], 255);
    }
  }

  const cv = buf.toCanvas();

  /* かざしたときの ぼんやりした 光の わ */
  if (lit && trans > .35){
    const { cv: out, g } = makeCv(S, S);
    g.globalAlpha = .55;
    g.filter = 'none';
    const grd = g.createRadialGradient(S / 2, S / 2, S * .1, S / 2, S / 2, S * .62);
    grd.addColorStop(0, glow);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    g.globalAlpha = 1;
    g.drawImage(cv, 0, 0);
    cache.set(key, out);
    return out;
  }

  cache.set(key, cv);
  return cv;
}

/* ---------- どろだんご（まだ 正体が わからない 石） ---------- */
const mudCache = new Map();
export function renderMud(seed = 1, S = 48){
  const key = seed + '|' + S;
  if (mudCache.has(key)) return mudCache.get(key);

  const buf = new Buf(S, S);
  const cx = (S - 1) / 2, cy = (S - 1) / 2, R = S * .47;
  // 石より かならず 大きく なるように、丸みを 強めに
  const rad = a => {
    const n = fbm(Math.cos(a) * 1.9 + 3, Math.sin(a) * 1.9 + 3, seed + 77, 3);
    return (.94 + n * .12) * (1 / Math.hypot(Math.cos(a) / 1, Math.sin(a) / .92));
  };
  const P = ['#4a3524', '#63472f', '#7d5c3c', '#3a2819'];

  for (let y = 0; y < S; y++){
    for (let x = 0; x < S; x++){
      const u = (x + .5 - cx) / R, v = (y + .5 - cy) / R;
      const a = Math.atan2(v, u), rr = Math.hypot(u, v) / rad(a);
      if (rr > 1) continue;
      const t = fbm(u * 3.2 + 4, v * 3.2 + 4, seed + 5, 4);
      let c = mixc(P[0], P[2], Math.round(clamp(t, 0, 1) * 4) / 4);
      const hp = hashInt(x, y, seed) / 4294967296;
      if (hp < .09) c = hex2rgb(P[3]);
      else if (hp < .14) c = mixc(P[2], '#b08a5c', .6);
      // 小石の つぶ
      if (hp > .975) c = mixc('#a89880', '#ffffff', .2);

      const h = Math.sqrt(Math.max(0, 1 - rr * rr)) * 1.1;
      const nl = Math.hypot(u, v, h) || 1;
      let d = (u / nl) * LIGHT_DIR[0] + (v / nl) * LIGHT_DIR[1] + (h / nl) * LIGHT_DIR[2];
      let sh = .6 + .6 * clamp(d, 0, 1);
      sh = Math.round(sh * 5) / 5;
      c = [c[0] * sh, c[1] * sh, c[2] * sh];
      if (rr > .95) c = [c[0] * .6, c[1] * .6, c[2] * .6];
      buf.set(x, y, c, 255);
    }
  }
  const cv = buf.toCanvas();
  mudCache.set(key, cv);
  return cv;
}

/* ---------- こびりついた どろ ----------
   石の 表面に かたく はりついた よごれ。水では おちない ので ブラシで こする。
   石の かたちで 切りぬくので、はみ出さない。
   --------------------------------------------------------- */
export function renderCrust(defOrId, seed = 1, S = 56){
  const def = typeof defOrId === 'string' ? STONE_BY_ID[defOrId] : defOrId;
  const { cv, g } = makeCv(S, S, true);
  const buf = new Buf(S, S);
  const r = rng(seed * 13 + 91);

  // かたまりを いくつか
  const lumps = [];
  const n = 3 + ((r() * 3) | 0);
  for (let i = 0; i < n; i++){
    const a = r() * Math.PI * 2, d = r() * .34;
    lumps.push({
      cx: S / 2 + Math.cos(a) * d * S,
      cy: S / 2 + Math.sin(a) * d * S,
      rad: S * (.11 + r() * .11),
      s: (r() * 1e6) | 0,
    });
  }
  const P = ['#4a3420', '#5f452b', '#75563a', '#3a2818'];

  for (let y = 0; y < S; y++){
    for (let x = 0; x < S; x++){
      let hit = 0;
      for (const L of lumps){
        const u = (x + .5 - L.cx) / L.rad, v = (y + .5 - L.cy) / L.rad;
        const d = Math.hypot(u, v) + (fbm(u * 1.8 + 3, v * 1.8 + 3, L.s, 3) - .5) * .85;
        if (d < 1){ hit = 1 - d; break; }
      }
      if (!hit) continue;
      const t = fbm(x * .22, y * .22, seed + 5, 3);
      let c = mixc(P[0], P[2], Math.round(clamp(t, 0, 1) * 3) / 3);
      const hp = hashInt(x, y, seed + 9) / 4294967296;
      if (hp < .12) c = hex2rgb(P[3]);
      else if (hp < .18) c = mixc(P[2], '#8f7a52', .5);
      if (hit > .62) c = mixc(c, '#ffffff', .12);          // もりあがり
      if (hit < .12) c = mixc(c, '#241a12', .3);           // ふちの かげ
      buf.set(x, y, c, 255);
    }
  }
  g.putImageData(buf.img, 0, 0);

  // 石の かたちで 切りぬく
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(renderStone(def, seed, S, 'normal', 0), 0, 0);
  g.globalCompositeOperation = 'source-over';
  return cv;
}

/* ---------- 星の 表示 ---------- */
export function stars(n){ return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

/* ---------- つや から ランク ---------- */
export function glossRank(g){
  if (g >= .85) return { label:'ぴかぴか', n:3 };
  if (g >= .5)  return { label:'つやつや', n:2 };
  if (g >= .2)  return { label:'すべすべ', n:1 };
  return { label:'そのまま', n:0 };
}
