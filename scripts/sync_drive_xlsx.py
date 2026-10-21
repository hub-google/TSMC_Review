#!/usr/bin/env python3
"""Sync the original Google Drive-hosted XLSX to static JSON for GitHub Pages.

Only standard Python XML/ZIP parsing is used after public Drive download.
The Drive file ID is intentionally stable: users edit the existing workbook,
not a replacement Google Sheet. The source must be downloadable publicly.
"""
import hashlib
import io
import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

SOURCE_ID = os.environ.get("SOURCE_FILE_ID", "15iZELwo2eZei5sBh7r8VuR4JcYUXeXVt")
SHEET = "廠區"
DESTINATION = Path(__file__).resolve().parents[1] / "data" / "data.json"
EXPECTED = [
    "區域中心", "業務區", "通訊處", "廠區", "駐廠日期",
    "FYC(目標72C)", "累月FYC差額",
    "新個險客戶數(目標20位)", "累月新客戶數差額", "象限",
]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "p": "http://schemas.openxmlformats.org/package/2006/relationships"}

def download():
    try:
        import gdown
    except ImportError as ex:
        raise RuntimeError("Missing gdown; install with pip install gdown") from ex
    import tempfile
    with tempfile.TemporaryDirectory() as directory:
        target = os.path.join(directory, "latest.xlsx")
        result = gdown.download(id=SOURCE_ID, output=target, quiet=True, use_cookies=False)
        if not result or not os.path.isfile(target):
            raise RuntimeError("Google Drive download failed. Check sharing permission and file ID.")
        payload = Path(target).read_bytes()
    if not zipfile.is_zipfile(io.BytesIO(payload)):
        raise RuntimeError("Downloaded content is not an XLSX workbook (possibly a Drive login page).")
    return payload

def excel_col(column):
    result = 0
    for c in column:
        result = result * 26 + ord(c.upper()) - 64
    return result - 1

def parse_number(value):
    if value is None or value == "":
        return None
    n = float(value)
    return int(n) if n.is_integer() else n

def parse_workbook(payload):
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        book = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
        found = None
        for sheet in book.findall("m:sheets/m:sheet", NS):
            if sheet.attrib.get("name") == SHEET:
                found = sheet
                break
        if found is None:
            raise ValueError("Missing worksheet '廠區'. Current sheets: " +
                             ", ".join(s.attrib["name"] for s in book.findall("m:sheets/m:sheet", NS)))
        rid = found.attrib["{" + NS["r"] + "}id"]
        path = targets[rid].lstrip("/")
        if not path.startswith("xl/"):
            path = "xl/" + path
        # Excel sometimes supplies leading ../ in relationship targets.
        path = __import__("posixpath").normpath(path)
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in ss.findall("m:si", NS):
                shared.append("".join(x.text or "" for x in si.findall(".//m:t", NS)))
        root = ET.fromstring(z.read(path))
        result = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            cells = [None] * 10
            for c in row.findall("m:c", NS):
                match = re.match(r"([A-Z]+)", c.attrib.get("r", ""))
                if not match:
                    continue
                ci = excel_col(match.group(1))
                if ci >= 10:
                    continue
                ty = c.attrib.get("t", "")
                v = c.find("m:v", NS)
                raw = v.text if v is not None else None
                if ty == "inlineStr":
                    cells[ci] = "".join(x.text or "" for x in c.findall(".//m:t", NS))
                elif ty == "s":
                    cells[ci] = shared[int(raw)] if raw is not None else None
                elif ty in ("str", "e"):
                    cells[ci] = raw
                elif ty == "b":
                    cells[ci] = bool(int(raw)) if raw is not None else None
                else:
                    cells[ci] = parse_number(raw)
            if any(x is not None for x in cells):
                result.append(cells)
    if not result:
        raise ValueError("Source sheet is empty")
    actual = [str(x or "").strip() for x in result[0]]
    if actual != EXPECTED:
        raise ValueError(f"Unexpected headers. Expected {EXPECTED}, got {actual}")
    rows = []
    for index, row in enumerate(result[1:], 2):
        if not row[0] and not row[2]:
            continue
        if not row[0] or not row[2]:
            raise ValueError(f"Missing region or office at row {index}")
        for i in (5, 6, 7, 8):
            if not isinstance(row[i], (int, float)):
                raise ValueError(f"Column {i+1} at row {index} should contain numeric data")
        if row[9] not in (1, 2, 3, 4):
            # Formula cell may not have a cached result after some Excel editors.
            # Replicate source mapping: 1 both pass, 2 new customer fails,
            # 3 both fail, 4 FYC fails.
            fyc_ok, customer_ok = row[6] >= 0, row[8] >= 0
            row[9] = 1 if fyc_ok and customer_ok else 2 if fyc_ok else 4 if customer_ok else 3
        rows.append(row)
    if not rows:
        raise ValueError("No valid review records; refusing to overwrite prior JSON")
    return rows

def main():
    payload = download()
    source_hash = hashlib.sha256(payload).hexdigest()
    previous = {}
    if DESTINATION.exists():
        previous = json.loads(DESTINATION.read_text(encoding="utf-8"))
    if previous.get("sourceHash") == source_hash:
        print("No source change; keeping prior JSON and its sync timestamp.")
        return
    rows = parse_workbook(payload)
    offices = len(set((x[0], x[2]) for x in rows))
    result = {
        "version": 1,
        "sourceFileId": SOURCE_ID,
        "sourceTitle": "考核預警.xlsx",
        "sheet": SHEET,
        "headers": EXPECTED,
        "syncedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceHash": source_hash,
        "rows": rows,
    }
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Synced {len(rows)} factory rows, {offices} distinct offices, "
          f"{len(set(r[0] for r in rows))} regions. SHA256={source_hash[:12]}")

if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        print(f"ERROR: sync failed without changing the prior data: {ex}", file=sys.stderr)
        sys.exit(1)
