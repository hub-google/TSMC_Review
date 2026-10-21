# TSMC 職域考核預警

**網站**：https://hub-google.github.io/TSMC_Review/

**資料來源**：固定讀取 Google Drive 內的 `考核預警.xlsx`（Drive file ID：`15iZELwo2eZei5sBh7r8VuR4JcYUXeXVt`），工作表為 `廠區`，**原檔與連結不需要更換**。

## 圖表定義

- 依 **區域中心**各產生一張四象限圖，首頁呈現四個區域中心的圖，可切換單區放大查看。
- **每個通訊處一個點**。同區同名稱通訊處若有多筆廠區紀錄，合併為一個點；點擊可以看到每一個廠區的獨立考核紀錄。
- 圖上每個象限的分類參照 Excel 的 `象限`（J 欄）：
  - Ⅰ：FYC 達標 + 新個險客戶數達標
  - Ⅱ：FYC 達標 + 新個險客戶數未達標
  - Ⅲ：FYC 未達標 + 新個險客戶數未達標
  - Ⅳ：FYC 未達標 + 新個險客戶數達標
- 若同一通訊處負責多個廠區，**任一個廠區未達標即視為通訊處該項目未達標**，避免預警被其他廠區的成績掩蓋。原始每個廠區的 J 欄分類仍保留於明細。
- **點位在所屬象限內為避免重疊而自動排列，不代表實際差額比例**。累月差額數值仍可在點選明細後查閱。來源表把達標部分的差額截為 0，所以無法用該差額直接繪製有意義的正向連續座標。
- 表格中的 FYC、新客戶數為 **各廠區紀錄加總**，新客戶數不是跨廠區去重人數，不能拿去當通訊處「唯一客戶數」。

## 資料更新

`.github/workflows/deploy.yml`：
- 於每小時 23 分（UTC）排程嘗試同步，或於推送 main 分支時、在 Actions 手動執行時同步。
- `scripts/sync_drive_xlsx.py` 用 gdown 下載**同一個 Google Drive 檔案 ID**，解析 `廠區` 工作表 A:J，驗證欄位後更新 `data/data.json`。
- 只有當來源 XLSX bytes 變更時才更新 JSON 並提交 commit。資料同步失敗時保留前一版 JSON，避免網站空白；在 Actions 可看見失敗的警示。
- 排程若持續沒有更新內容，28 天建立一次空提交，避免 GitHub 因儲存庫過久無活動而停用定時執行。
- GitHub Scheduled Actions 並非即時保證，可能延遲。當來源資料更新後，需要待下一次同步完成，再重新整理網站看到新資料。

**資料來源權限**：排程的 gdown 需要來源 Excel 至少開啟「知道連結的任何人可檢視」。目前檔案曾被觀察到設定為「知道連結的人可編輯」，建議改成「檢視者」，以免未授權修改。若不想讓資料公開，必須改用私有資料源/內部驗證站台；GitHub Pages 及此公開儲存庫目前不適合作為機密資料的保護措施。

## 首次啟用 GitHub Pages

此儲存庫初建時 Pages 尚未開啟，需要儲存庫管理員執行**一次**：

1. 開啟 [Settings → Pages](https://github.com/hub-google/TSMC_Review/settings/pages)。
2. 在 **Build and deployment → Source** 選 **GitHub Actions**。
3. 到 [Actions](https://github.com/hub-google/TSMC_Review/actions/workflows/deploy.yml) 將「同步資料與部署網站」執行一次（Run workflow），或等下次排程。
4. 確認兩個工作（同步、部署）皆成功後使用 [網站連結](https://hub-google.github.io/TSMC_Review/)。

不需要新增其他 workflow，也不需要更換來源檔案連結。
