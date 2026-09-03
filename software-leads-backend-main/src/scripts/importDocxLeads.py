import zipfile
import re
import json
import xml.etree.ElementTree as ET
import os

docx_path = r"c:\xampp\htdocs\dunga_tech\Leads.docx"

if not os.path.exists(docx_path):
    print(f"Error: {docx_path} not found.")
    exit(1)

with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read("word/document.xml")

root = ET.fromstring(xml_content)

entries = []
seen = set()

for p in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
    p_text = "".join([t.text for t in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if t.text]).strip()
    if not p_text:
        continue
    nums = re.findall(r"\b[6-9]\d{9}\b", p_text)
    for n in nums:
        if n not in seen:
            seen.add(n)
            note = p_text.replace(n, "").strip()
            entries.append({"phone": n, "note": note})

out_json = r"c:\xampp\htdocs\dunga_tech\software-leads-backend-main\src\scripts\extracted_leads.json"
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(entries, f, indent=2)

print(f"Successfully extracted {len(entries)} unique lead phone numbers to {out_json}")
