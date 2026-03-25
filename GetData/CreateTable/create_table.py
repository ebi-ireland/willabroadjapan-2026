"""
University Dataset Automation Script v2
========================================
使い方:
  pip install requests beautifulsoup4 openpyxl
  python university_dataset_v2.py

出力:
  dataset_YYYY_MM_DD.xlsx  ← フリーズ・チェックボックス・色分け付き
  dataset_YYYY_MM_DD.csv   ← 同内容のCSV（チェックボックスは TRUE/FALSE）
  ※ 既存ファイルがあれば (1)(2)... と連番

出力先: スクリプトと同じフォルダ
  例: C:/Users/user/OneDrive/Desktop/willabroadjapan/GetData/CreateTable/
"""

import time
import json
import csv
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

# ────────────────────────────────────────────────────────────
# ★ 設定エリア ★
# ────────────────────────────────────────────────────────────

COUNTRIES = {
    "アイスランド":             "https://www.unirank.org/is/a-z/",
    "アイルランド":             "https://www.unirank.org/ie/a-z/",
    "アゼルバイジャン":         "https://www.unirank.org/az/a-z/",
    "アメリカ":                 "https://www.unirank.org/us/a-z/",
    "アメリカンバージンアイランド": "https://www.unirank.org/vi/ranking/",
    "アラブ首長国連邦":         "https://www.unirank.org/ae/a-z/",
    "アルゼンチン":             "https://www.unirank.org/ar/a-z/",
    "アルバニア":               "https://www.unirank.org/al/a-z/",
    "アルメニア":               "https://www.unirank.org/am/a-z/",
    "アンドラ":                 "https://www.unirank.org/ad/ranking/",
    "イギリス":                 "https://www.unirank.org/gb/a-z/",
    "イスラエル":               "https://www.unirank.org/il/a-z/",
    "イタリア":                 "https://www.unirank.org/it/a-z/",
    "インド":                   "https://www.unirank.org/in/a-z/",
    "インドネシア":             "https://www.unirank.org/id/a-z/",
    "ウズベキスタン":           "https://www.unirank.org/uz/a-z/",
    "ウルグアイ":               "https://www.unirank.org/uy/a-z/",
    "エクアドル":               "https://www.unirank.org/ec/a-z/",
    "エジプト":                 "https://www.unirank.org/eg/a-z/",
    "エストニア":               "https://www.unirank.org/ee/a-z/",
    "オーストラリア":           "https://www.unirank.org/au/a-z/",
    "オーストリア":             "https://www.unirank.org/at/a-z/",
    "オマーン":                 "https://www.unirank.org/om/a-z/",
    "オランダ":                 "https://www.unirank.org/nl/a-z/",
    "カザフスタン":             "https://www.unirank.org/kz/a-z/",
    "カタール":                 "https://www.unirank.org/qa/a-z/",
    "カナダ":                   "https://www.unirank.org/ca/a-z/",
    "韓国":                     "https://www.unirank.org/kr/a-z/",
    "北マケドニア":             "https://www.unirank.org/mk/a-z/",
    "キプロス":                 "https://www.unirank.org/cy/a-z/",
    "キュラソー":               "https://www.unirank.org/cw/a-z/",
    "キューバ":                 "https://www.unirank.org/cu/a-z/",
    "ギリシャ":                 "https://www.unirank.org/gr/a-z/",
    "キルギス":                 "https://www.unirank.org/kg/a-z/",
    "グアテマラ":               "https://www.unirank.org/gt/a-z/",
    "グアドループ":             "https://www.unirank.org/gp/ranking/",
    "グアム":                   "https://www.unirank.org/gu/a-z/",
    "クウェート":               "https://www.unirank.org/kw/a-z/",
    "グリーンランド":           "https://www.unirank.org/gl/a-z/",
    "グレナダ":                 "https://www.unirank.org/gd/a-z/",
    "クロアチア":               "https://www.unirank.org/hr/a-z/",
    "コスタリカ":               "https://www.unirank.org/cr/a-z/",
    "コソボ":                   "https://www.unirank.org/xk/a-z/",
    "コロンビア":               "https://www.unirank.org/co/a-z/",
    "サウジアラビア":           "https://www.unirank.org/sa/a-z/",
    "サモア":                   "https://www.unirank.org/ws/a-z/",
    "サンマリノ":               "https://www.unirank.org/sm/ranking/",
    "ジョージア":               "https://www.unirank.org/ge/a-z/",
    "シンガポール":             "https://www.unirank.org/sg/a-z/",
    "スイス":                   "https://www.unirank.org/ch/a-z/",
    "スウェーデン":             "https://www.unirank.org/se/a-z/",
    "スペイン":                 "https://www.unirank.org/es/a-z/",
    "スリランカ":               "https://www.unirank.org/lk/a-z/",
    "スロバキア":               "https://www.unirank.org/sk/a-z/",
    "スロベニア":               "https://www.unirank.org/si/a-z/",
    "セルビア":                 "https://www.unirank.org/rs/",
    "タイ":                     "https://www.unirank.org/th/a-z/",
    "台湾":                     "https://www.unirank.org/tw/a-z/",
    "チェコ":                   "https://www.unirank.org/cz/a-z/",
    "中国":                     "https://www.unirank.org/cn/a-z/",
    "デンマーク":               "https://www.unirank.org/dk/a-z/",
    "ドイツ":                   "https://www.unirank.org/de/a-z/",
    "ドミニカ共和国":           "https://www.unirank.org/do/a-z/",
    "トルコ":                   "https://www.unirank.org/tr/a-z/",
    "ニューカレドニア":         "https://www.unirank.org/nc/ranking/",
    "ニュージーランド":         "https://www.unirank.org/nz/a-z/",
    "ネパール":                 "https://www.unirank.org/np/a-z/",
    "ノルウェー":               "https://www.unirank.org/no/a-z/",
    "バーレーン":               "https://www.unirank.org/bh/a-z/",
    "パナマ":                   "https://www.unirank.org/pa/a-z/",
    "パプアニューギニア":       "https://www.unirank.org/pg/a-z/",
    "パラグアイ":               "https://www.unirank.org/py/a-z/",
    "ハンガリー":               "https://www.unirank.org/hu/a-z/",
    "バングラデシュ":           "https://www.unirank.org/bd/a-z/",
    "フィジー":                 "https://www.unirank.org/fj/a-z/",
    "フィリピン":               "https://www.unirank.org/ph/a-z/",
    "フィンランド":             "https://www.unirank.org/fi/a-z/",
    "プエルトリコ":             "https://www.unirank.org/pr/a-z/",
    "ブータン":                 "https://www.unirank.org/bt/a-z/",
    "ブラジル":                 "https://www.unirank.org/br/a-z/",
    "フランス":                 "https://www.unirank.org/fr/a-z/",
    "ブルガリア":               "https://www.unirank.org/bg/a-z/",
    "ブルネイ":                 "https://www.unirank.org/bn/a-z/",
    "フレンチポリネシア":       "https://www.unirank.org/pf/ranking/",
    "ベトナム":                 "https://www.unirank.org/vn/a-z/",
    "ペルー":                   "https://www.unirank.org/pe/a-z/",
    "ベルギー":                 "https://www.unirank.org/be/a-z/",
    "ポーランド":               "https://www.unirank.org/pl/a-z/",
    "ボスニアヘルツェゴビナ":   "https://www.unirank.org/ba/a-z/",
    "ボリビア":                 "https://www.unirank.org/bo/a-z/",
    "ポルトガル":               "https://www.unirank.org/pt/a-z/",
    "香港":                     "https://www.unirank.org/hk/a-z/",
    "マカオ":                   "https://www.unirank.org/mo/a-z/",
    "マルタ":                   "https://www.unirank.org/mt/a-z/",
    "マレーシア":               "https://www.unirank.org/my/a-z/",
    "南アフリカ":               "https://www.unirank.org/za/a-z/",
    "メキシコ":                 "https://www.unirank.org/mx/a-z/",
    "モーリシャス":             "https://www.unirank.org/mu/a-z/",
    "モナコ":                   "https://www.unirank.org/mc/ranking/",
    "モルディブ":               "https://www.unirank.org/mv/ranking/",
    "モルドバ":                 "https://www.unirank.org/md/a-z/",
    "モロッコ":                 "https://www.unirank.org/ma/a-z/",
    "モンゴル":                 "https://www.unirank.org/mn/a-z/",
    "モンテネグロ":             "https://www.unirank.org/me/ranking/",
    "ラオス":                   "https://www.unirank.org/la/ranking/",
    "ラトビア":                 "https://www.unirank.org/lv/a-z/",
    "リトアニア":               "https://www.unirank.org/lt/a-z/",
    "ルーマニア":               "https://www.unirank.org/ro/a-z/",
    "ルクセンブルク":           "https://www.unirank.org/lu/a-z/",
    "レユニオン":               "https://www.unirank.org/re/a-z/",
    "ヨルダン":                 "https://www.unirank.org/jo/a-z/",
}

# スクリプトと同じフォルダに出力
OUTPUT_DIR = Path(__file__).parent

TEST_MODE = False       # True: サンプルデータで動作確認
GEOCODE_DELAY     = 3.0   # 通常リクエスト間隔（秒）
GEOCODE_RETRY_MAX = 5     # レート制限時の最大リトライ回数
GEOCODE_RETRY_WAIT = 60   # レート制限検知時の待機秒数（429受信 or 連続失敗）
PROGRESS_FILE        = OUTPUT_DIR / "geocode_progress.json"   # ジオコーディング進捗（中断再開用）
SCRAPE_PROGRESS_FILE = OUTPUT_DIR / "scrape_progress.json"    # スクレイピング進捗（国ごとに保存）

# ────────────────────────────────────────────────────────────
# 通貨マッピング（国名 → 通貨記号）
# ────────────────────────────────────────────────────────────

CURRENCY_MAP = {
    # 米ドル
    "アメリカ": "USD", "アメリカンバージンアイランド": "USD",
    "グアム": "USD", "プエルトリコ": "USD", "パナマ": "USD",
    "エクアドル": "USD", "エルサルバドル": "USD", "東ティモール": "USD",
    # オーストラリアドル
    "オーストラリア": "AUD",
    # カナダドル
    "カナダ": "CAD",
    # 韓国ウォン
    "韓国": "KRW",
    # シンガポールドル
    "シンガポール": "SGD",
    # 中国元
    "中国": "CNY", "マカオ": "CNY",
    # ニュージーランドドル
    "ニュージーランド": "NZD",
    # ポンド
    "イギリス": "GBP",
    # ユーロ
    # アイスランドはISKクローナ → 指定通貨リスト外なのでUSD（下のデフォルト処理で対応）
    "アイルランド": "EUR", "イタリア": "EUR", "ドイツ": "EUR",
    "フランス": "EUR", "スペイン": "EUR", "オランダ": "EUR",
    "ベルギー": "EUR", "ポルトガル": "EUR", "オーストリア": "EUR",
    "フィンランド": "EUR", "ギリシャ": "EUR", "スロベニア": "EUR",
    "スロバキア": "EUR", "エストニア": "EUR", "ラトビア": "EUR",
    "リトアニア": "EUR", "ルクセンブルク": "EUR", "マルタ": "EUR",
    "キプロス": "EUR", "モナコ": "EUR", "アンドラ": "EUR",
    "サンマリノ": "EUR", "バチカン": "EUR",
    "グアドループ": "EUR", "レユニオン": "EUR", "フレンチポリネシア": "EUR",
    "ニューカレドニア": "EUR",
    # リンギット
    "マレーシア": "MYR",
    # UAEディルハム
    "アラブ首長国連邦": "AED",
    # ※ アイスランドはISKだが指定通貨リスト外 → USD扱い
}

def get_currency(country_name: str) -> str:
    """国名から通貨コードを返す。指定通貨リスト外はUSD。"""
    return CURRENCY_MAP.get(country_name, "USD")

# ────────────────────────────────────────────────────────────
# チェックボックス対象カラム
# ────────────────────────────────────────────────────────────

CHECKBOX_COLUMNS = set([
    # 奨学金留学生チェック
    "Need available", "non need available", "both not available",
    # 学問分野
    "Agriculture", "Natural resources and conservation", "Architecture",
    "Area, ethnic, and gender studies", "Communication/journalism",
    "Communication technologies", "Computer and information sciences",
    "Personal and culinary services", "Education", "Engineering",
    "Engineering technologies", "Foreign languages, literatures, and linguistics",
    "Family and consumer sciences", "Law/legal studies", "English",
    "Liberal arts/general studies", "Library science", "Biological/life sciences",
    "Mathematics and statistics", "Military science and military technologies",
    "Interdisciplinary studies", "Parks and recreation",
    "Philosophy and religious studies", "Theology and religious vocations",
    "Physical sciences", "Science technologies", "Psychology",
    "Homeland Security, law enforcement, firefighting, and protective services",
    "Public administration and social services", "Social sciences",
    "Construction trades", "Mechanic and repair technologies",
    "Precision production", "Transportation and materials moving",
    "Visual and performing arts", "Health professions and related programs",
    "Business/marketing", "History",
    # 語学条件（チェックボックス）
    "スコア提出はあるがスコア条件はなし",
    # 奨学金種別
    "全額免除奨学金", "授業料免除奨学金", "Need-based Scholarship", "Need-Met 100%",
    "柳井正財団", "笹川平和財団", "グルーバンクロフト基金", "東進海外進学支援制度",
    "江副リクルート記念財団", "YouAreWelcomeHere Scholarship",
    "Stamps Scholar Program", "Laidlaw Scholars",
    "日本の全財団奨学生の進学した大学",
    # 大学特性
    "学部生のみ", "大学院生もいるがかなり少ない", "大学院生の割合が多い",
    "PhD課程あり", "研究型大学", "大学群・ラベリングのある大学",
    "日本人学生が10人以下の大学", "日本からの直行便がある",
    "空港から公共交通で90分圏内", "公共交通2時間圏内に大都市あり",
    "学生福祉（バス無料など）", "ウーバーや配車サービスあり", "24時間図書館あり",
])

# ────────────────────────────────────────────────────────────
# 全カラム定義
# ────────────────────────────────────────────────────────────

COLUMNS = [
    "大学名", "国", "都市", "緯度", "経度", "URL", "気候",
    # CDS
    "学生数", "全体合格率",
    "男性受験者数", "女性受験者数", "男性合格者数", "女性合格者数",
    "男性入学者数", "女性入学者数",
    "全体出願者数", "全体合格者数", "全体入学者数",
    "留学生出願者数", "留学生合格者数", "留学生入学者数",
    "SAT提出割合", "ACT提出割合",
    "SAT Composite", "SAT EBRW", "SAT Math",
    "ACT Composite", "ACT Math", "ACT Science", "ACT Reading",
    "GPA", "区間の下限", "下限までの累計", "区間のパーセンテージ",
    "Priority Date", "Deferred Admission",
    "ED出願者数", "ED合格者数", "EA出願者数", "EA合格者数",
    # 費用（通貨定義を費用カラム群の直前に追加）
    "通貨定義",
    "Tuition", "文系平均", "理系平均", "現地語平均",
    "Required Fees", "Food and housing total", "Housing Only", "Food Only",
    "Books and supplies",
    # 奨学金
    "Need総数", "Need-Met", "Need全体平均額",
    "Merit全体数", "Merit平均額",
    "Need available", "non need available", "both not available",
    "Need留学生総数", "Need留学生平均額",
    # クラスサイズ
    "2-9", "10-19", "20-29", "30-39", "40-49", "50-99", "100+", "Total",
    # 学問分野
    "Agriculture", "Natural resources and conservation", "Architecture",
    "Area, ethnic, and gender studies", "Communication/journalism",
    "Communication technologies", "Computer and information sciences",
    "Personal and culinary services", "Education", "Engineering",
    "Engineering technologies", "Foreign languages, literatures, and linguistics",
    "Family and consumer sciences", "Law/legal studies", "English",
    "Liberal arts/general studies", "Library science", "Biological/life sciences",
    "Mathematics and statistics", "Military science and military technologies",
    "Interdisciplinary studies", "Parks and recreation",
    "Philosophy and religious studies", "Theology and religious vocations",
    "Physical sciences", "Science technologies", "Psychology",
    "Homeland Security, law enforcement, firefighting, and protective services",
    "Public administration and social services", "Social sciences",
    "Construction trades", "Mechanic and repair technologies",
    "Precision production", "Transportation and materials moving",
    "Visual and performing arts", "Health professions and related programs",
    "Business/marketing", "History",
    # 語学条件（スコア数値）
    "TOEFL 総合", "TOEFL Reading", "TOEFL Listening", "TOEFL Writing", "TOEFL Speaking",
    "IELTS 総合", "IELTS Reading", "IELTS Listening", "IELTS Writing", "IELTS Speaking",
    "Duolingo 総合", "Duolingo Literacy", "Duolingo Comprehension",
    "Duolingo Conversation", "Duolingo Production",
    # 語学条件（チェックボックス）
    "スコア提出はあるがスコア条件はなし",
    # 奨学金種別チェック
    "全額免除奨学金", "授業料免除奨学金", "Need-based Scholarship", "Need-Met 100%",
    "柳井正財団", "笹川平和財団", "グルーバンクロフト基金", "東進海外進学支援制度",
    "江副リクルート記念財団", "YouAreWelcomeHere Scholarship",
    "Stamps Scholar Program", "Laidlaw Scholars",
    "日本の全財団奨学生の進学した大学",
    "奨学金が反映される出願締め切り月", "大学入試最終出願締め切り月",
    # 大学特性チェック
    "学部生のみ", "大学院生もいるがかなり少ない", "大学院生の割合が多い",
    "PhD課程あり", "研究型大学", "大学群・ラベリングのある大学",
    "日本人学生が10人以下の大学", "日本からの直行便がある",
    "空港から公共交通で90分圏内", "公共交通2時間圏内に大都市あり",
    "学生福祉（バス無料など）", "ウーバーや配車サービスあり", "24時間図書館あり",
]

HEADERS_HTTP = {"User-Agent": "Mozilla/5.0 (compatible; UniversityDatasetBot/1.0)"}

# ────────────────────────────────────────────────────────────
# ファイル名生成（連番）
# ────────────────────────────────────────────────────────────

def get_output_stem() -> Path:
    """重複しないファイル名のステム(拡張子なし)を返す。"""
    today = datetime.now().strftime("%Y_%m_%d")
    base = OUTPUT_DIR / f"dataset_{today}"
    if not base.with_suffix(".xlsx").exists() and not base.with_suffix(".csv").exists():
        return base
    i = 1
    while True:
        candidate = OUTPUT_DIR / f"dataset_{today}({i})"
        if not candidate.with_suffix(".xlsx").exists() and not candidate.with_suffix(".csv").exists():
            return candidate
        i += 1

# ────────────────────────────────────────────────────────────
# スクレイピング
# ────────────────────────────────────────────────────────────

def scrape_unirank(country_name: str, url: str) -> list:
    try:
        resp = requests.get(url, headers=HEADERS_HTTP, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        print(f"  [ERROR] {country_name}: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    universities = []
    for tr in soup.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 3:
            continue
        a_tag = tds[1].find("a")
        if not a_tag:
            continue
        name = a_tag.get_text(strip=True)
        href = a_tag.get("href", "")
        full_url = f"https://www.unirank.org{href}" if href.startswith("/") else href
        city = tds[2].get_text(strip=True)
        if name:
            universities.append({"大学名": name, "国": country_name, "都市": city, "URL": ""})
    print(f"  → {country_name}: {len(universities)}大学")
    return universities

# ────────────────────────────────────────────────────────────
# ジオコーディング（Nominatim）
# ────────────────────────────────────────────────────────────

def geocode(name: str, city: str, country: str) -> tuple:
    """Nominatim でジオコーディング。レート制限時はバックオフリトライ。"""
    base_url = "https://nominatim.openstreetmap.org/search"
    queries = [name, f"{name}, {city}, {country}"]

    for query in queries:
        for attempt in range(GEOCODE_RETRY_MAX):
            try:
                resp = requests.get(
                    base_url,
                    params={"q": query, "format": "json", "limit": 1},
                    headers={"User-Agent": "UniversityDatasetBot/1.0 (study-abroad-db)"},
                    timeout=15,
                )
                if resp.status_code == 429:
                    wait = GEOCODE_RETRY_WAIT * (attempt + 1)
                    print(f"\n    [429 Rate Limit] {wait}秒待機中...", flush=True)
                    time.sleep(wait)
                    continue
                data = resp.json()
                if data:
                    time.sleep(GEOCODE_DELAY)
                    return float(data[0]["lat"]), float(data[0]["lon"])
                break  # 結果なし → 次のクエリへ
            except Exception:
                wait = GEOCODE_RETRY_WAIT * (attempt + 1)
                print(f"\n    [ERROR] リトライ{attempt+1}/{GEOCODE_RETRY_MAX} {wait}秒待機...", flush=True)
                time.sleep(wait)
        time.sleep(GEOCODE_DELAY)
    return None, None

# ────────────────────────────────────────────────────────────
# テスト用サンプルデータ
# ────────────────────────────────────────────────────────────

def get_sample_data() -> list:
    return [
        {"大学名": "University of Iceland",           "国": "アイスランド", "都市": "Reykjavik", "緯度": 64.1391, "経度": -21.9525, "URL": ""},
        {"大学名": "Reykjavik University",             "国": "アイスランド", "都市": "Reykjavik", "緯度": 64.1178, "経度": -21.9305, "URL": ""},
        {"大学名": "Agricultural University of Iceland","国": "アイスランド", "都市": "Borgarnes",  "緯度": 64.5375, "経度": -21.9188, "URL": ""},
        {"大学名": "Trinity College Dublin",           "国": "アイルランド", "都市": "Dublin",    "緯度": 53.3438, "経度": -6.2546,  "URL": ""},
        {"大学名": "University College Dublin",        "国": "アイルランド", "都市": "Dublin",    "緯度": 53.3065, "経度": -6.2199,  "URL": ""},
        {"大学名": "University College Cork",          "国": "アイルランド", "都市": "Cork",      "緯度": 51.8936, "経度": -8.4919,  "URL": ""},
        {"大学名": "University of Galway",             "国": "アイルランド", "都市": "Galway",    "緯度": 53.2779, "経度": -9.0597,  "URL": ""},
        {"大学名": "Dublin City University",           "国": "アイルランド", "都市": "Dublin",    "緯度": 53.3862, "経度": -6.2575,  "URL": ""},
    ]

# ────────────────────────────────────────────────────────────
# 同一国内の重複大学名に (1)(2)... を付加
# ────────────────────────────────────────────────────────────

def deduplicate_names(universities: list):
    """同一国内で同名の大学が複数ある場合に (1)(2)... を付加する。"""
    # (国, 大学名) の出現数をカウント
    key_count: dict = {}
    for uni in universities:
        k = (uni["国"], uni["大学名"])
        key_count[k] = key_count.get(k, 0) + 1

    # 2件以上ある場合のみ連番付加
    key_seen: dict = {}
    for uni in universities:
        k = (uni["国"], uni["大学名"])
        if key_count[k] > 1:
            key_seen[k] = key_seen.get(k, 0) + 1
            uni["大学名"] = f"{uni['大学名']}({key_seen[k]})"

    dupes = sum(1 for v in key_count.values() if v > 1)
    if dupes:
        print(f"  → 重複大学名を {dupes} 件検出し、連番を付加しました")


# ────────────────────────────────────────────────────────────
# 通貨を自動補完
# ────────────────────────────────────────────────────────────

def fill_currency(universities: list):
    for uni in universities:
        uni["通貨定義"] = get_currency(uni.get("国", ""))

# ────────────────────────────────────────────────────────────
# Excel 作成
# ────────────────────────────────────────────────────────────

# セクションごとのヘッダー背景色
SECTION_COLORS = {
    "大学名":       "1F4E79",  # 濃紺（基本情報）
    "学生数":       "1F497D",  # 紺（CDS）
    "通貨定義":     "375623",  # 深緑（費用）
    "Need総数":     "7B3F00",  # 茶（奨学金）
    "2-9":          "404040",  # 濃灰（クラスサイズ）
    "Agriculture":  "4B0082",  # 紫（学問）
    "TOEFL 総合":   "006400",  # 濃緑（語学）
    "全額免除奨学金":"8B0000",  # 深赤（奨学金種別）
    "学部生のみ":   "00008B",  # 紺（大学特性）
}

def get_header_color(col_name: str, col_idx: int, columns: list) -> str:
    """カラムがどのセクションに属するかで色を返す。"""
    # セクション開始カラムより後ろのカラムは同じ色を継続
    current_color = "1F4E79"
    for name, color in SECTION_COLORS.items():
        try:
            section_start = columns.index(name)
        except ValueError:
            continue
        if col_idx - 1 >= section_start:
            current_color = color
    return current_color


def build_excel(universities: list, output_path: Path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "大学データ"

    header_font = Font(name="Arial", bold=True, color="FFFFFF", size=10)
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # ── ヘッダー行
    for col_idx, col_name in enumerate(COLUMNS, start=1):
        color = get_header_color(col_name, col_idx, COLUMNS)
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = PatternFill("solid", start_color=color, end_color=color)
        cell.alignment = header_align

    ws.row_dimensions[1].height = 45

    data_font = Font(name="Arial", size=10)
    alt_fill  = PatternFill("solid", start_color="EBF3FB", end_color="EBF3FB")
    cb_fill   = PatternFill("solid", start_color="F0F8E8", end_color="F0F8E8")  # チェックボックス列の薄緑

    # チェックボックス列インデックス（1-based）
    cb_col_indices = {
        col_idx for col_idx, col_name in enumerate(COLUMNS, start=1)
        if col_name in CHECKBOX_COLUMNS
    }

    # ── データ行
    max_row = len(universities) + 1
    for row_idx, uni in enumerate(universities, start=2):
        is_alt = (row_idx % 2 == 0)
        for col_idx, col_name in enumerate(COLUMNS, start=1):
            value = uni.get(col_name, None)
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = data_font

            if col_idx in cb_col_indices:
                # チェックボックス列: 薄緑背景
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.fill = cb_fill
                if value is None:
                    cell.value = "FALSE"
            else:
                cell.alignment = Alignment(
                    horizontal="left" if col_name in ("大学名", "URL") else "center",
                    vertical="center",
                )
                if is_alt:
                    cell.fill = alt_fill

    # DataValidation: Python 3.14 + openpyxl の add_data_validation() フリーズバグを回避するため
    # 内部リストへ直接 append する（sqref の MultiCellRange.__contains__ の無限ループを回避）
    for cb_col_idx in cb_col_indices:
        letter = get_column_letter(cb_col_idx)
        dv = DataValidation(
            type="list",
            formula1='"TRUE,FALSE"',
            allow_blank=True,
            sqref=f"{letter}2:{letter}{max_row}",
        )
        dv.showDropDown = False
        ws.data_validations.dataValidation.append(dv)

    # ── 列幅
    col_widths = {
        "大学名": 42, "国": 16, "都市": 18, "URL": 52,
        "緯度": 13, "経度": 13, "気候": 14, "通貨定義": 12,
    }
    for col_idx, col_name in enumerate(COLUMNS, start=1):
        letter = get_column_letter(col_idx)
        ws.column_dimensions[letter].width = col_widths.get(col_name, 13)

    # ── フリーズ: 1行目 + A列
    ws.freeze_panes = "B2"

    # ── オートフィルター
    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}1"

    wb.save(output_path)
    print(f"  ✅ Excel: {output_path.name}  ({len(universities)}大学 / {len(COLUMNS)}カラム)")


# ────────────────────────────────────────────────────────────
# CSV 作成
# ────────────────────────────────────────────────────────────

def build_csv(universities: list, output_path: Path):
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for uni in universities:
            row = {}
            for col in COLUMNS:
                val = uni.get(col, "")
                # チェックボックス列はデフォルト FALSE
                if col in CHECKBOX_COLUMNS and (val is None or val == ""):
                    val = "FALSE"
                row[col] = val
            writer.writerow(row)
    print(f"  ✅ CSV:   {output_path.name}")


# ────────────────────────────────────────────────────────────
# メイン
# ────────────────────────────────────────────────────────────

def main():
    print("=" * 55)
    print("  大学データセット 自動生成スクリプト v2")
    print("=" * 55)

    if TEST_MODE:
        print("\n[テストモード] サンプルデータを使用します")
        all_universities = get_sample_data()
    else:
        all_universities = []

        # ── STEP 1: スクレイピング（国ごとに保存して中断再開対応）
        print(f"\n[STEP 1] unirank.org スクレイピング ({len(COUNTRIES)}カ国)")
        scraped: dict = {}
        if SCRAPE_PROGRESS_FILE.exists():
            with open(SCRAPE_PROGRESS_FILE, encoding="utf-8") as f:
                scraped = json.load(f)
            print(f"  → スクレイピング進捗を読み込みました ({len(scraped)}カ国済み)")

        for country_name, url in COUNTRIES.items():
            if country_name in scraped:
                unis = scraped[country_name]
                all_universities.extend(unis)
                print(f"  {country_name}: {len(unis)}大学 [スキップ（保存済み）]")
                continue
            print(f"  {country_name}: {url}")
            unis = scrape_unirank(country_name, url)
            all_universities.extend(unis)
            # 即座に保存（中断対策）
            scraped[country_name] = unis
            with open(SCRAPE_PROGRESS_FILE, "w", encoding="utf-8") as f:
                json.dump(scraped, f, ensure_ascii=False)
            time.sleep(2)

        print(f"\n  合計 {len(all_universities)} 大学を取得")

        if not all_universities:
            print("\n[警告] データが取得できませんでした。TEST_MODE = True で動作確認してください。")
            return

        # ── STEP 1.5: 同一国内の重複大学名に連番付加（ジオコーディング前に実施）
        print(f"\n[STEP 1.5] 重複大学名チェック...")
        deduplicate_names(all_universities)

        # ── STEP 2: ジオコーディング（大学名+国名をキーにして中断再開対応）
        print(f"\n[STEP 2] ジオコーディング (Nominatim / OpenStreetMap)")
        print(f"  進捗ファイル: {PROGRESS_FILE}")

        progress = {}
        if PROGRESS_FILE.exists():
            with open(PROGRESS_FILE, encoding="utf-8") as f:
                progress = json.load(f)
            done = sum(1 for v in progress.values() if v["lat"] is not None)
            print(f"  → 前回の進捗を読み込みました ({len(progress)}件保存済み、うち成功{done}件)")

        for i, uni in enumerate(all_universities, start=1):
            # キーは「国名||大学名」で一意性を確保（同名別国の混同を防ぐ）
            key = f"{uni['国']}||{uni['大学名']}"
            if key in progress:
                uni["緯度"] = progress[key]["lat"]
                uni["経度"] = progress[key]["lon"]
                print(f"  ({i:5d}/{len(all_universities)}) {uni['大学名'][:40]}... [スキップ]")
                continue

            print(f"  ({i:5d}/{len(all_universities)}) {uni['大学名'][:40]}...", end=" ", flush=True)
            lat, lon = geocode(uni["大学名"], uni["都市"], uni["国"])
            uni["緯度"] = lat
            uni["経度"] = lon

            # 即座に進捗を保存（中断対策）
            progress[key] = {"lat": lat, "lon": lon}
            with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
                json.dump(progress, f, ensure_ascii=False)

            print(f"lat={lat:.4f}, lon={lon:.4f}" if lat else "取得失敗")

        print(f"\n  ジオコーディング完了。進捗ファイルは {PROGRESS_FILE.name} に保存されています。")
        print(f"  全件完了後に不要であれば削除してください。")

    # テストモード時のみ重複チェック（通常モードはSTEP 1.5で実施済み）
    if TEST_MODE:
        print("\n[STEP 1.5] 重複大学名チェック...")
        deduplicate_names(all_universities)

    # 通貨自動補完
    print("\n[STEP 3] 通貨定義を自動補完...")
    fill_currency(all_universities)
    for uni in all_universities:
        print(f"  {uni['大学名'][:30]:30s}  →  {uni['通貨定義']}")

    # ファイル出力
    stem = get_output_stem()
    xlsx_path = stem.with_suffix(".xlsx")
    csv_path  = stem.with_suffix(".csv")

    print(f"\n[STEP 4] ファイル出力")
    build_excel(all_universities, xlsx_path)
    build_csv(all_universities, csv_path)

    # JSON バックアップ
    json_path = stem.with_suffix(".json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_universities, f, ensure_ascii=False, indent=2)
    print(f"  ✅ JSON:  {json_path.name}  (バックアップ)")

    print(f"\n完了！ 出力先: {OUTPUT_DIR.resolve()}")
    print(f"  ※ 全件完了したら scrape_progress.json と geocode_progress.json は削除して構いません")


if __name__ == "__main__":
    main()