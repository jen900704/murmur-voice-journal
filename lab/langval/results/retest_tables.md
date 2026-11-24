# Retest tables (written by run_retest.py)

### en_goemotions_dev (5422 texts before, 5422 after; 94 texts with a changed count in any category)

| Category | n target | AUC before (adjusted) | AUC after (adjusted) | After minus before (95%) | AUC vs other emotional, before / after | r before / after | Target texts with a hit, before / after | Neutral texts with a hit, before / after | Hit precision, before / after | Verdict before | Verdict after |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `posemo` | 2218 | .79 (.77 to .81) | .79 (.77 to .81) | +.001 (-.001 to +.003) | .80 / .80 | .41 / .41 | 66.2% / 65.9% | 10.4% / 9.8% | 82.2% / 83.0% | supported | supported |
| `negemo` | 1241 | .71 (.69 to .74) | .71 (.69 to .74) | 0 (0 to 0) | .72 / .73 | .32 / .32 | 55.8% / 55.8% | 13.9% / 13.9% | 55.8% / 55.9% | supported | supported |
| `anx` | 105 | .76 (.69 to .83) | .76 (.69 to .83) | 0 (0 to 0) | .76 / .76 | .50 / .50 | 52.4% / 52.4% | 0.6% / 0.6% | 52.9% / 52.9% | supported | supported |
| `anger` | 449 | .68 (.65 to .72) | .68 (.65 to .72) | 0 (0 to 0) | .69 / .69 | .37 / .37 | 43.0% / 43.0% | 6.4% / 6.4% | 40.6% / 40.9% | supported | supported |
| `sad` | 153 | .72 (.66 to .78) | .72 (.66 to .78) | 0 (0 to 0) | .71 / .71 | .35 / .35 | 45.1% / 45.1% | 1.6% / 1.6% | 34.5% / 34.5% | supported | supported |
| `grat` | 358 | .94 (.92 to .96) | .94 (.92 to .96) | 0 (0 to 0) | .94 / .94 | .67 / .67 | 88.3% / 88.3% | 0.3% / 0.3% | 91.1% / 91.1% | supported | supported |
| `affil` | 401 | .75 (.72 to .79) | .75 (.72 to .79) | -.001 (-.004 to +.001) | .75 / .75 | .45 / .45 | 56.1% / 55.9% | 6.5% / 6.3% | 42.4% / 43.2% | supported | supported |
| `loss` | 13 | .84 (.63 to 1.00) | .84 (.63 to 1.00) | 0 (0 to 0) | .84 / .84 | .42 / .42 | 69.2% / 69.2% | 2.4% / 2.4% | 6.5% / 6.5% | supported | supported |
| `apology` | 68 | .95 (.89 to .99) | .95 (.89 to .99) | 0 (0 to 0) | .94 / .94 | .76 / .76 | 89.7% / 89.7% | 0.4% / 0.4% | 54.5% / 54.5% | supported | supported |
| `tone` | 2095 pos, 1118 neg | .87 (.85 to .88) | .87 (.85 to .88) | +.001 (0 to +.002) |  | .51 / .51 |  |  |  | supported | supported |

Matched forms counted fewer or more times after the fix (form, change in count):

- `affil`: 564 hits before, 550 after. Fewer: huge -14. More: none.
- `anger`: 513 hits before, 510 after. Fewer: yellow -3. More: none.
- `anx`: 115 hits before, 115 after. Fewer: none. More: none.
- `apology`: 115 hits before, 115 after. Fewer: none. More: none.
- `grat`: 366 hits before, 366 after. Fewer: none. More: none.
- `loss`: 146 hits before, 146 after. Fewer: none. More: none.
- `negemo`: 1493 hits before, 1490 after. Fewer: yellow -3. More: none.
- `posemo`: 2236 hits before, 2204 after. Fewer: huge -14, health -8, healthy -6, healthcare -4. More: none.
- `sad`: 208 hits before, 208 after. Fewer: none. More: none.

### zh_cped_valid (11127 texts before, 11127 after; 72 texts with a changed count in any category)

| Category | n target | AUC before (adjusted) | AUC after (adjusted) | After minus before (95%) | AUC vs other emotional, before / after | r before / after | Target texts with a hit, before / after | Neutral texts with a hit, before / after | Hit precision, before / after | Verdict before | Verdict after |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `posemo` | 1689 | .52 (.51 to .53) | .52 (.51 to .53) | 0 (0 to 0) | .53 / .53 | .08 / .08 | 7.8% / 7.8% | 3.6% / 3.7% | 35.8% / 35.9% | not supported | not supported |
| `negemo` | 6003 | .52 (.51 to .52) | .52 (.51 to .52) | 0 (-.002 to +.002) | .51 / .51 | .07 / .07 | 7.1% / 6.7% | 3.7% / 3.3% | 68.1% / 69.1% | not supported | not supported |
| `anx` | 778 | .51 (.50 to .51) | .51 (.50 to .51) | 0 (0 to 0) | .50 / .50 | .04 / .04 | 1.8% / 1.8% | 0.8% / 0.8% | 10.4% / 10.4% | not supported | not supported |
| `anger` | 1607 | .51 (.50 to .52) | .51 (.50 to .51) | -.002 (-.005 to +.001) | .51 / .51 | .07 / .07 | 3.1% / 2.4% | 1.2% / 0.8% | 25.9% / 26.2% | not supported | not supported |
| `sad` | 1719 | .50 (.50 to .51) | .50 (.50 to .51) | 0 (0 to +.001) | .50 / .50 | .04 / .04 | 1.0% / 1.1% | 0.3% / 0.3% | 32.1% / 33.3% | not supported | not supported |
| `grat` | 13 | .92 (.81 to 1.00) | .92 (.81 to 1.00) | 0 (0 to 0) | .92 / .92 | .40 / .40 | 84.6% / 84.6% | 0.6% / 0.6% | 16.9% / 16.9% | supported | supported |
| `tone` | 1689 pos, 6003 neg | .54 (.53 to .55) | .54 (.53 to .55) | 0 (-.002 to +.002) |  | .11 / .11 |  |  |  | not supported | not supported |

Matched forms counted fewer or more times after the fix (form, change in count):

- `anger`: 198 hits before, 152 after. Fewer: 幹 -47. More: 生氣 +1.
- `anx`: 138 hits before, 138 after. Fewer: none. More: none.
- `grat`: 65 hits before, 65 after. Fewer: none. More: none.
- `negemo`: 660 hits before, 618 after. Fewer: 幹 -47. More: 難受 +3, 生氣 +1, 低落 +1.
- `posemo`: 378 hits before, 380 after. Fewer: none. More: 高興 +2.
- `sad`: 61 hits before, 62 after. Fewer: none. More: 低落 +1.

### zh_cped_valid_unconverted (11127 texts before, 11127 after; 5151 texts with a changed count in any category)

| Category | n target | AUC before (adjusted) | AUC after (adjusted) | After minus before (95%) | AUC vs other emotional, before / after | r before / after | Target texts with a hit, before / after | Neutral texts with a hit, before / after | Hit precision, before / after | Verdict before | Verdict after |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `posemo` | 1689 | .51 (.50 to .51) | .52 (.51 to .53) | +.016 (+.009 to +.023) | .51 / .53 | .04 / .08 | 2.4% / 7.8% | 1.3% / 3.7% | 30.5% / 35.9% | not supported | not supported |
| `negemo` | 6003 | .51 (.50 to .51) | .52 (.51 to .52) | +.009 (+.006 to +.013) | .50 / .51 | .05 / .07 | 2.9% / 6.3% | 1.3% / 2.9% | 67.2% / 70.3% | not supported | not supported |
| `anx` | 778 | .50 (.50 to .51) | .51 (.50 to .51) | +.003 (-.001 to +.006) | .50 / .50 | .03 / .06 | 0.9% / 1.8% | 0.3% / 0.7% | 9.9% / 11.1% | not supported | not supported |
| `anger` | 1607 | .50 (.50 to .51) | .51 (.50 to .51) | +.004 (+.001 to +.007) | .50 / .51 | .04 / .07 | 0.7% / 2.0% | 0.2% / 0.6% | 27.9% / 28.3% | not supported | not supported |
| `sad` | 1719 | .50 (.50 to .51) | .50 (.50 to .51) | +.001 (-.001 to +.003) | .50 / .50 | .06 / .05 | 0.7% / 1.1% | 0.0% / 0.2% | 27.9% / 33.9% | not supported | not supported |
| `grat` | 13 | .50 (.50 to .50) | .92 (.81 to 1.00) | +.420 (+.342 to +.498) | .50 / .92 | .00 / .40 | 0.0% / 84.6% | 0.1% / 0.6% | 0.0% / 16.9% | not supported | supported |
| `tone` | 1689 pos, 6003 neg | .51 (.50 to .52) | .54 (.53 to .55) | +.030 (+.023 to +.037) |  | .04 / .11 |  |  |  | not supported | not supported |

Matched forms counted fewer or more times after the fix (form, change in count):

- `anger`: 43 hits before, 115 after. Fewer: 瞧不起 -3, 王八蛋 -1, 抱怨 -1, 埋怨 -1. More: 脾氣 +18, 討厭 +10, 生氣 +10, 媽的 +8, 罵 +6, 氣死 +6, 發火 +3, 嗆 +3, 翻臉 +3, 嫌棄 +2, 恨 +1, 賭氣 +1.
- `anx`: 71 hits before, 129 after. Fewer: 害怕 -1. More: 著急 +18, 擔心 +13, 壓力 +10, 緊張 +3, 嚇死 +2, 恐懼 +2, 驚嚇 +2, 顧慮 +2, 煩惱 +2, 不安 +1, 憂慮 +1, 壓力大 +1.
- `grat`: 8 hits before, 65 after. Fewer: none. More: 謝謝 +41, 感謝 +9, 福氣 +3, 回報 +1, 報答 +1, 幸運 +1, 多虧 +1.
- `negemo`: 262 hits before, 568 after. Fewer: 哭 -6, 瞧不起 -3, 痛苦 -2, 哭了 -2, 王八蛋 -1, 抱怨 -1, 害怕 -1, 受不了 -1, 埋怨 -1, 委屈 -1. More: 對不起 +26, 不喜歡 +20, 難受 +19, 脾氣 +18, 著急 +18, 擔心 +13, 可憐 +12, 煩 +12, 討厭 +10, 生氣 +10, 壓力 +10, 不高興 +9.
- `posemo`: 133 hits before, 380 after. Fewer: 笑 -4, 漂亮 -2. More: 謝謝 +41, 喜歡 +35, 不錯 +28, 愛 +25, 高興 +12, 踏實 +10, 帥 +8, 感謝 +8, 厲害 +7, 驚喜 +6, 還不錯 +6, 放鬆 +6.
- `sad`: 43 hits before, 61 after. Fewer: 哭 -6, 哭了 -2, 委屈 -1. More: 難過 +7, 傷心 +6, 捨不得 +5, 不開心 +2, 沒意思 +2, 拋棄 +2, 眼淚 +2, 低落 +1.

### Share of CPED validation utterances with at least one hit

| Category | Simplified as written, before | Simplified as written, after | Converted with OpenCC first, before | Converted with OpenCC first, after |
|---|---|---|---|---|
| `posemo` | 1.2% | 3.3% | 3.3% | 3.3% |
| `negemo` | 2.3% | 4.8% | 5.6% | 5.2% |
| `anx` | 0.6% | 1.1% | 1.2% | 1.2% |
| `anger` | 0.4% | 1.0% | 1.7% | 1.3% |
| `sad` | 0.4% | 0.5% | 0.5% | 0.5% |
| `grat` | 0.1% | 0.6% | 0.6% | 0.6% |
