---
name: file-organizer
description: Intelligently organizes files and folders by understanding context, finding duplicates, and suggesting better organizational structures. Use when asked to clean up, organize, or restructure file systems.
---

# File Organizer

This skill acts as your personal organization assistant, helping you maintain a clean, logical file structure across your computer without the mental overhead of constant manual organization.

## When to Use This Skill

- Downloads folder is getting out of control
- Can't find files when you need them
- Duplicate files wasting disk space
- Projects folder is disorganized
- Need to restructure a directory for better workflow
- Preparing files for archiving or backup

## What This Skill Does

1. **Analyzes Structure**: Reviews current file/folder organization
2. **Identifies Issues**: Finds duplicates, misplaced files, poor naming
3. **Proposes Plan**: Shows what changes will be made BEFORE acting
4. **Executes Safely**: Only moves/renames after user approval
5. **Documents Changes**: Logs all operations for easy undo

## Instructions

When a user requests file organization help:

### Step 1: Understand the Scope

Ask clarifying questions:
- Which directory needs organization? (Downloads, Documents, entire home folder?)
- What's the main problem? (Can't find things, duplicates, too messy, no structure?)
- Any files or folders to avoid? (Current projects, sensitive data?)
- How aggressively to organize? (Conservative vs. comprehensive cleanup)

### Step 2: Analyze Current State

```bash
# Windows (PowerShell)
Get-ChildItem -Path "C:\Users\User\Downloads" -Recurse | Group-Object Extension | Sort-Object Count -Descending
Get-ChildItem -Path "C:\Users\User\Downloads" | Measure-Object -Property Length -Sum

# Mac/Linux
ls -la ~/Downloads
find ~/Downloads -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn
du -sh ~/Downloads/* | sort -rh | head -20
```

Summarize:
- Total files and folders
- File type breakdown
- Size distribution
- Date ranges
- Obvious organization issues

### Step 3: Propose Organization Plan

Present a clear plan BEFORE making any changes:

```markdown
# Organization Plan for [Directory]

## Current State
- X files, Y folders, Z GB total
- File types: [breakdown]
- Issues: [list problems]

## Proposed Structure
[Directory]/
├── Documents/
├── Images/
├── Videos/
├── Archives/
└── Misc/

## Changes I'll Make
1. Create folders: [list]
2. Move files: X PDFs → Documents/, Y images → Images/
3. Delete duplicates: [list if any]

## Files Needing Your Decision
- [List ambiguous files]

Ready to proceed? (yes/no/modify)
```

### Step 4: Execute (After Approval)

```powershell
# Windows: Move files
Move-Item -Path "source\file.pdf" -Destination "dest\file.pdf"

# Create folder structure
New-Item -ItemType Directory -Path "C:\organized\Documents"
```

```bash
# Mac/Linux: Move files
mv "old/path/file.pdf" "new/path/file.pdf"
mkdir -p ~/organized/Documents
```

**Rules**:
- ALWAYS confirm before deleting anything
- Log all moves for potential undo
- Handle filename conflicts (add number suffix)
- Stop and ask if unexpected situations arise

### Step 5: Provide Summary

```markdown
# Organization Complete! ✨

## What Changed
- Created X new folders
- Organized Y files
- Freed Z GB by removing duplicates

## Maintenance Tips
1. Weekly: Sort new downloads
2. Monthly: Review completed projects
3. Quarterly: Check for duplicates
```

## Common Organization Patterns

| File Type | Recommended Folder |
|-----------|-------------------|
| PDF, DOCX, TXT | Documents/ |
| JPG, PNG, SVG | Images/ |
| MP4, MOV | Videos/ |
| ZIP, RAR | Archives/ |
| XLSX, CSV | Spreadsheets/ |
| PPTX, KEY | Presentations/ |

## Pro Tips

- Use `YYYY-MM-DD - Description.ext` naming for dated files
- Keep "Current Projects" at root level for quick access
- Archive (don't delete) files older than 2 years
- Never organize someone else's files without explicit permission
