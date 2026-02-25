---
name: skill-creator
description: Provides guidance for creating effective Claude Skills that extend capabilities with specialized knowledge, workflows, and tool integrations. Use when you need to create a new skill for Claude.
---

# Skill Creator

This skill helps you create high-quality Claude Skills that are reusable, well-documented, and effective.

## When to Use This Skill

- Creating a new skill from scratch
- Improving an existing skill
- Converting a workflow into a reusable skill
- Packaging domain knowledge as a skill

## About Skills

### What Skills Provide

Skills extend Claude's capabilities by providing:
- **Specialized knowledge** in a specific domain
- **Reusable workflows** for common tasks
- **Tool integrations** and scripting patterns
- **Consistent outputs** through structured formats

### Anatomy of a Skill

```
skill-name/
├── SKILL.md          # Required: Instructions and metadata
├── scripts/          # Optional: Helper scripts
├── templates/        # Optional: Document templates
└── resources/        # Optional: Reference files
```

### SKILL.md Structure

```yaml
---
name: skill-name
description: Clear description of what this skill does and when to use it.
---
```

Followed by markdown with:
- **When to Use** - Clear trigger conditions
- **What It Does** - Capabilities overview
- **Instructions** - Step-by-step Claude instructions
- **Examples** - Real-world usage examples

## Skill Creation Process

### Step 1: Understand the Goal

Ask clarifying questions:
- What specific task does this skill accomplish?
- What inputs does it need?
- What outputs should it produce?
- What tools or scripts are needed?

### Step 2: Plan the Skill Contents

Determine:
- Core instructions for Claude
- Required helper scripts
- Templates or resources needed
- Example inputs and outputs

### Step 3: Initialize the Skill

Create the folder structure:
```bash
mkdir -p .agent/skills/my-skill-name
touch .agent/skills/my-skill-name/SKILL.md
```

### Step 4: Write the SKILL.md

Use this template:
```markdown
---
name: my-skill-name
description: A clear description of what this skill does and when to use it.
---

# Skill Name

Brief description of the skill's purpose.

## When to Use This Skill
- Use case 1
- Use case 2

## What This Skill Does
1. Step 1
2. Step 2

## Instructions
[Detailed instructions for Claude]

## Examples
[Real-world examples]
```

### Step 5: Add Supporting Files

- Scripts go in `scripts/` directory
- Templates go in `templates/` directory
- Reference docs go in `resources/` directory

### Step 6: Test and Iterate

- Test with real use cases
- Refine based on output quality
- Add edge case handling

## Best Practices

- Focus on ONE specific, repeatable task per skill
- Write instructions FOR Claude, not for end users
- Include concrete examples with expected outputs
- Document prerequisites and dependencies
- Add error handling guidance
- Keep SKILL.md concise but complete
- Use clear trigger phrases in descriptions
