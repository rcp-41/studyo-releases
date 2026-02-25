---
name: tailored-resume-generator
description: Analyzes job descriptions and generates tailored resumes that highlight relevant experience, skills, and achievements to maximize interview chances. Use when applying for specific job positions.
---

# Tailored Resume Generator

This skill analyzes job descriptions and generates highly targeted resumes that speak directly to what each employer is looking for.

## When to Use This Skill

- Applying for a specific job position
- Customizing resume for different industries or roles
- Highlighting relevant experience for career transitions
- Optimizing resume for ATS (Applicant Tracking Systems)
- Creating multiple resume versions for different job applications

## What This Skill Does

1. **Analyzes Job Descriptions**: Extracts key requirements, skills, and keywords
2. **Identifies Priorities**: Determines what employers value most
3. **Tailors Content**: Reorganizes and emphasizes relevant experience
4. **Optimizes Keywords**: Incorporates ATS-friendly keywords naturally
5. **Formats Professionally**: Creates clean, professional resume layouts
6. **Provides Recommendations**: Suggests improvements and highlights gaps

## Instructions

### Step 1: Gather Information

Ask the user to provide:
- The job description (full text preferred)
- Their current resume or background information
- Years of experience and key skills
- Any specific achievements or projects to highlight

### Step 2: Analyze Job Requirements

Extract from the job description:
- **Required skills** (must-haves)
- **Preferred skills** (nice-to-haves)
- **Key responsibilities** the role involves
- **Industry keywords** and terminology
- **Seniority level** expectations
- **Company culture** signals
- **ATS keywords** (typically nouns: "Python", "project management", "Agile")

### Step 3: Map Experience to Requirements

Create a mapping:
| Job Requirement | Candidate Experience | Match Level |
|----------------|---------------------|-------------|
| React development | 3 years React at Company X | Strong |
| Team leadership | Led 4-person team | Moderate |

### Step 4: Structure the Tailored Resume

**Order sections by relevance**:
1. Contact Information
2. Professional Summary (tailored to this role)
3. Core Skills (matching job requirements first)
4. Work Experience (emphasize relevant achievements)
5. Education
6. Certifications/Projects (if relevant)

**For each work experience bullet**:
- Start with action verb
- Include measurable impact when possible
- Mirror language from job description
- Format: "Action + Task + Result/Impact"

Example:
```
✗ "Worked on database optimization"
✓ "Optimized PostgreSQL queries, reducing page load time by 40% and supporting 50K+ daily users"
```

### Step 5: Optimize for ATS

- Use the exact keywords from the job description
- Avoid tables, graphics, headers/footers (ATS can't parse these)
- Use standard section names: "Work Experience", "Education", "Skills"
- Include both spelled-out and abbreviated versions: "Artificial Intelligence (AI)"

### Step 6: Format and Present

Provide the resume in:
1. **Clean Markdown** for easy editing
2. Guidance on converting to PDF/DOCX

**Resume length guidelines**:
- 0-5 years experience: 1 page
- 5-10 years: 1-2 pages
- 10+ years: 2 pages max

### Step 7: Provide Strategic Recommendations

After the resume:
- Highlight strongest matching points
- Note any gaps to address in cover letter
- Suggest skills to acquire for future applications
- Recommend specific achievements to elaborate on

## Tips for Best Results

- More specific job descriptions = more tailored resumes
- Provide quantifiable achievements (%, $, numbers)
- Mention specific technologies, tools, and methodologies
- Include context about the size/scope of companies you've worked at

## Privacy Note

Never include in a resume:
- Social Security Number
- Date of birth
- Marital status
- Photo (in most Western countries)
- Home address (city/state is sufficient)
