---
name: invoice-organizer
description: Automatically organizes invoices and receipts for tax preparation by reading files, extracting information, and renaming consistently. Use when organizing financial documents for accounting or tax purposes.
---

# Invoice Organizer

This skill automatically organizes your invoices and receipts into a clean, tax-ready structure by reading files, extracting key information, and applying consistent naming.

## When to Use This Skill

- Preparing documents for tax season
- Organizing expense reports
- Cleaning up messy financial file downloads
- Archiving business receipts
- Reconciling monthly expenses

## What This Skill Does

1. **Scans Invoice Files**: Reads PDFs, images, and documents
2. **Extracts Key Info**: Vendor, date, amount, invoice number, category
3. **Renames Consistently**: Applies standard naming convention
4. **Sorts into Folders**: By year, category, or vendor
5. **Creates Summary**: Generates expense summary spreadsheet

## Instructions

### Step 1: Understand the Setup

Ask the user:
- Where are the invoices currently stored?
- What organization method do they prefer? (by vendor / by category / by date)
- What file types? (PDF, JPEG, PNG, email exports)
- Date range to organize?
- Any specific categories relevant to their business?

### Step 2: Scan the Directory

```powershell
# Windows: List all invoice-type files
Get-ChildItem -Path "C:\Invoices" -Recurse -Include "*.pdf","*.jpg","*.png","*.jpeg"
```

```bash
# Mac/Linux
find ~/Invoices -type f \( -name "*.pdf" -o -name "*.jpg" -o -name "*.png" \)
```

### Step 3: Extract Information

For each file, extract:
- **Vendor/Supplier name**
- **Invoice date** (YYYY-MM-DD format)
- **Invoice number** (if present)
- **Total amount** (with currency)
- **Category** (software, hardware, services, travel, utilities, etc.)
- **Tax-deductible?** (yes/no/partial)

### Step 4: Propose Naming Convention

Standard naming format:
```
YYYY-MM-DD - Vendor Name - Amount - InvoiceNumber.ext
```

Examples:
```
2024-03-15 - Adobe Inc - $54.99 - INV-2024-0315.pdf
2024-03-20 - AWS - $127.43 - None.pdf
2024-03-22 - Delta Airlines - $389.00 - TICKET-XK7291.pdf
```

### Step 5: Folder Structure Options

**Option A: By Year/Month**
```
Invoices/
├── 2024/
│   ├── 01-January/
│   ├── 02-February/
│   └── 03-March/
└── 2023/
```

**Option B: By Category (Tax-Friendly)**
```
Invoices/
├── Software-Subscriptions/
├── Hardware/
├── Professional-Services/
├── Travel-Meals/
├── Utilities/
└── Other/
```

**Option C: By Vendor**
```
Invoices/
├── Adobe/
├── AWS/
├── Google/
└── Others/
```

### Step 6: Execute Organization

After user approves the plan:

```powershell
# Windows: Create folder structure and rename
New-Item -ItemType Directory -Force -Path "C:\Organized-Invoices\2024\Software"
Rename-Item -Path "old_name.pdf" -NewName "2024-03-15 - Adobe - $54.99.pdf"
Move-Item -Path "2024-03-15 - Adobe - $54.99.pdf" -Destination "C:\Organized-Invoices\2024\Software\"
```

### Step 7: Generate Summary

Create a CSV summary:
```csv
Date,Vendor,Amount,Category,Invoice Number,File Path
2024-03-15,Adobe Inc,$54.99,Software,INV-2024-0315,2024/Software/...
```

## Common Invoice Categories

| Category | Examples |
|----------|---------|
| Software | Adobe, Microsoft 365, GitHub, Slack |
| Cloud/Hosting | AWS, Google Cloud, Vercel |
| Hardware | Laptops, monitors, peripherals |
| Professional Services | Contractors, consultants, legal |
| Travel | Flights, hotels, car rental |
| Meals | Business lunches, team dinners |
| Marketing | Ads, design tools, printing |
| Utilities | Internet, phone, electricity |

## Tips

- Rename files immediately after downloading - it's easier than bulk renaming later
- Keep digital AND paper receipts for amounts over $75
- "Unknown" amounts should be manually verified before tax filing
- Create a separate folder for "Needs Review" if you can't extract info automatically
