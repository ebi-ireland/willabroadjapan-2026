import csv, json, os

csv_filename = "college_scholarship_regular.csv"
json_filename = "scholarships.json"

with open(csv_filename, encoding='utf-8') as f:
    data = list(csv.DictReader(f))

with open(json_filename, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ {os.path.abspath(json_filename)} を作成しました！")
