---
name: raffle-winner-picker
description: Randomly selects winners from lists, spreadsheets, or Google Sheets for giveaways and contests with cryptographically secure randomness. Use when running contests, giveaways, or random selections.
---

# Raffle Winner Picker

This skill randomly and fairly selects winners from participant lists using cryptographically secure randomness to ensure unbiased results.

## When to Use This Skill

- Running a giveaway or contest
- Selecting random winners from a list
- Picking random participants for surveys or testing
- Running office raffles or prize drawings
- Selecting random items from any list fairly

## What This Skill Does

1. **Accepts Any List Format**: CSV, spreadsheet paste, newline-separated text
2. **Validates Entries**: Checks for duplicates, empty entries, formatting issues
3. **Uses Secure Randomness**: Cryptographically secure random selection
4. **Picks Multiple Winners**: Can select N winners without replacement
5. **Provides Audit Trail**: Shows selection process for transparency

## Instructions

### Step 1: Collect the Participant List

Ask the user to provide the list in any format:
- Pasted text (one entry per line)
- CSV data
- Names and emails from a spreadsheet

Also ask:
- How many winners to select?
- Should duplicate entries be removed?
- Should winners be weighted? (e.g., more entries = higher chance)

### Step 2: Parse and Validate

Clean the list:
```python
import secrets

def parse_entries(raw_list):
    # Split by newlines or commas
    entries = [e.strip() for e in raw_list.replace(',', '\n').split('\n')]
    # Remove empty entries
    entries = [e for e in entries if e]
    return entries

def remove_duplicates(entries):
    return list(dict.fromkeys(entries))  # Preserves order

def validate(entries):
    print(f"Total entries: {len(entries)}")
    duplicates = len(entries) - len(set(entries))
    if duplicates > 0:
        print(f"Duplicates found: {duplicates}")
    return entries
```

Report to user:
- Total entries received
- Duplicates found (and whether removed)
- Final entry count

### Step 3: Select Winners

```python
import secrets

def pick_winners(entries, num_winners):
    """Cryptographically secure random selection."""
    if num_winners > len(entries):
        raise ValueError(f"Cannot pick {num_winners} from {len(entries)} entries")
    
    # Create a copy to avoid modifying original
    pool = entries.copy()
    winners = []
    
    for i in range(num_winners):
        # secrets.randbelow is cryptographically secure
        idx = secrets.randbelow(len(pool))
        winners.append(pool.pop(idx))
    
    return winners

# Example usage:
entries = ["Alice", "Bob", "Charlie", "Diana", "Eve"]
winners = pick_winners(entries, num_winners=2)
```

### Step 4: Present Results

```markdown
# 🎉 Raffle Results

## Entry Summary
- Total entries: [N]
- Duplicates removed: [N] (if applicable)
- Final pool: [N] participants
- Winners requested: [N]

## 🏆 Winners

1. **[Winner 1]**
2. **[Winner 2]**
3. **[Winner 3]**

## Verification
This selection used cryptographically secure random number generation (Python's `secrets` module / `crypto.getRandomValues()`) to ensure fairness.

*Selected on [Date] at [Time]*
```

### Step 5: Handle Edge Cases

- **Tie-breaking**: If weighted entries, explain the weighting
- **Invalid entries**: List any entries that were removed and why
- **Re-draw**: If a winner can't be reached, offer to pick an alternate
- **Audit**: Offer to show the full shuffled list order

## Weighted Raffle (Optional)

If participants earn multiple entries (e.g., newsletter sub = 1 entry, purchase = 5 entries):

```python
def weighted_pick(participants_with_weights, num_winners):
    # Expand list based on weights
    pool = []
    for name, weight in participants_with_weights:
        pool.extend([name] * weight)
    
    return pick_winners(pool, num_winners)

# Example:
participants = [
    ("Alice", 3),   # 3 entries
    ("Bob", 1),     # 1 entry
    ("Charlie", 5), # 5 entries
]
```

## Why This is Fair

- Uses `secrets` module (Python) or `crypto.getRandomValues()` (JS)
- These are cryptographically secure, unlike `random.choice()` or `Math.random()`
- Each entry has an equal probability regardless of list position
- No human interference in the selection process
