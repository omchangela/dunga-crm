import os
import pymupdf

pdf_dir = r"C:\xampp\htdocs\dunga_tech\software-leads-backend-main\test_output_pdfs"
output_dir = r"C:\Users\user\.gemini\antigravity-ide\brain\33eeeffa-0c6c-420a-a357-60a431a0bdb3\pdf_previews"

os.makedirs(output_dir, exist_ok=True)

files = [
    ("1_estimation_proposal_sample.pdf", "estimation"),
    ("2_project_contract_agreement_sample.pdf", "contract"),
    ("3_payment_receipt_sample.pdf", "receipt"),
]

for filename, tag in files:
    filepath = os.path.join(pdf_dir, filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
    
    doc = pymupdf.open(filepath)
    print(f"Processing {filename} ({len(doc)} pages)...")
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        img_name = f"{tag}_page_{i+1}.png"
        img_path = os.path.join(output_dir, img_name)
        pix.save(img_path)
        print(f"  Saved page {i+1}: {img_name}")

print("\nDone converting PDF pages to PNG!")
