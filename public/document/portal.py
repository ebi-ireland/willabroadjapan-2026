import pandas as pd
import json

def create_scholarship_website(excel_file, output_file):
    """
    奨学金情報のインタラクティブなウェブページを生成する
    """
    # Excelファイルを読み込む
    df = pd.read_excel(excel_file)
    
    # DataFrameをJSONに変換
    json_data = df.to_json(orient='records', force_ascii=False)
    
    html_template = """
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>奨学金情報検索</title>
        <style>
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            .search-container { 
                margin-bottom: 20px;
                padding: 20px;
                background-color: #f8f9fa;
                border-radius: 8px;
            }
            .search-box { 
                padding: 8px;
                width: 200px;
                margin-bottom: 10px;
            }
            .filter-container { 
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
                margin: 10px 0;
            }
            .filter-item {
                margin: 5px 0;
            }
            select {
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            table { 
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            th, td { 
                padding: 12px 8px;
                border: 1px solid #ddd;
                font-size: 14px;
            }
            th { 
                background-color: #f5f5f5;
                position: sticky;
                top: 0;
            }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .hidden { display: none; }
            .reset-button {
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
            }
            .reset-button:hover {
                background-color: #c82333;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="search-container">
                <input type="text" id="searchBox" class="search-box" placeholder="キーワード検索">
                <div class="filter-container">
                    <div class="filter-item">
                        <select id="universityFilter">
                            <option value="">大学を選択</option>
                        </select>
                    </div>
                    <div class="filter-item">
                        <select id="regionFilter">
                            <option value="">地域を選択</option>
                        </select>
                    </div>
                    <div class="filter-item">
                        <select id="countryFilter">
                            <option value="">国を選択</option>
                        </select>
                    </div>
                    <div class="filter-item">
                        <select id="typeFilter">
                            <option value="">奨学金タイプを選択</option>
                            <option value="全額奨学金">全額奨学金</option>
                            <option value="授業料免除">授業料免除</option>
                            <option value="Need-based">Need-based</option>
                        </select>
                    </div>
                </div>
                <button class="reset-button" onclick="resetFilters()">検索条件をリセット</button>
            </div>
            <table id="scholarshipTable">
                <thead>
                    <tr id="headerRow"></tr>
                </thead>
                <tbody id="tableBody"></tbody>
            </table>
        </div>

        <script>
            // データの読み込み
            const scholarshipData = %s;
            
            // テーブルの初期化
            function initializeTable() {
                const headerRow = document.getElementById('headerRow');
                const columns = Object.keys(scholarshipData[0]);
                
                // ヘッダーの生成
                columns.forEach(column => {
                    const th = document.createElement('th');
                    th.textContent = column;
                    headerRow.appendChild(th);
                });
                
                // フィルターの初期化
                initializeFilters();
                
                updateTable();
            }
            
            // フィルターの初期化
            function initializeFilters() {
                // 大学フィルター
                const universities = [...new Set(scholarshipData.map(item => item['大学名']))];
                populateFilter('universityFilter', universities);
                
                // 地域フィルター
                const regions = [...new Set(scholarshipData.map(item => item['地域']))];
                populateFilter('regionFilter', regions);
                
                // 国フィルター
                const countries = [...new Set(scholarshipData.map(item => item['国']))];
                populateFilter('countryFilter', countries);
            }
            
            // フィルターの選択肢を設定
            function populateFilter(filterId, options) {
                const filter = document.getElementById(filterId);
                options.sort().forEach(option => {
                    if (option) {  // null や undefined をスキップ
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        filter.appendChild(optionElement);
                    }
                });
            }
            
            // テーブルの更新
            function updateTable() {
                const searchTerm = document.getElementById('searchBox').value.toLowerCase();
                const selectedUniversity = document.getElementById('universityFilter').value;
                const selectedRegion = document.getElementById('regionFilter').value;
                const selectedCountry = document.getElementById('countryFilter').value;
                const selectedType = document.getElementById('typeFilter').value;
                
                const tableBody = document.getElementById('tableBody');
                tableBody.innerHTML = '';
                
                scholarshipData.forEach(row => {
                    if (matchesFilter(row, searchTerm, selectedUniversity, selectedRegion, selectedCountry, selectedType)) {
                        const tr = document.createElement('tr');
                        Object.values(row).forEach(value => {
                            const td = document.createElement('td');
                            td.textContent = value || '';
                            tr.appendChild(td);
                        });
                        tableBody.appendChild(tr);
                    }
                });
            }
            
            // フィルター条件のチェック
            function matchesFilter(row, searchTerm, university, region, country, type) {
                const matchesSearch = Object.values(row).some(value => 
                    String(value).toLowerCase().includes(searchTerm)
                );
                const matchesUniversity = !university || row['大学名'] === university;
                const matchesRegion = !region || row['地域'] === region;
                const matchesCountry = !country || row['国'] === country;
                const matchesType = !type || row['奨学金タイプ'] === type;
                
                return matchesSearch && matchesUniversity && matchesRegion && 
                       matchesCountry && matchesType;
            }
            
            // フィルターのリセット
            function resetFilters() {
                document.getElementById('searchBox').value = '';
                document.getElementById('universityFilter').value = '';
                document.getElementById('regionFilter').value = '';
                document.getElementById('countryFilter').value = '';
                document.getElementById('typeFilter').value = '';
                updateTable();
            }
            
            // イベントリスナーの設定
            document.getElementById('searchBox').addEventListener('input', updateTable);
            document.getElementById('universityFilter').addEventListener('change', updateTable);
            document.getElementById('regionFilter').addEventListener('change', updateTable);
            document.getElementById('countryFilter').addEventListener('change', updateTable);
            document.getElementById('typeFilter').addEventListener('change', updateTable);
            
            // 初期化
            initializeTable();
        </script>
    </body>
    </html>
    """ % json_data
    
    # HTMLファイルとして保存
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_template)

if __name__ == "__main__":
    create_scholarship_website('scholarships.xlsx', 'index.html')