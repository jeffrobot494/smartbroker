# AI Candidate Filtering Tool (Low-Code Architecture with Make.com)

Get Company name, domain name, and LinkedIn profile URL from Apollo
Criteria 1: Product vs service
Scrape website using Browserless/Puppeterr + ScrapingBee
Analyse text with ChatGPT

Criteria 2: Number of Employees
Scan LinkedIn profile with PhantomBuster (PB Starter tier $69/month)
Use People Data Labs API to supplement (includes country) ($100+ /month)

Criteria 3: Vertical Market Software
Analyse website text with ChatGPT

Criteria 4: Bootstrapped? Uses a confidence score, difficult to know for sure
Analyse website text with ChatGPT
Use People Data Labs API
Use Crunchbase API ($100/month)

Criteria 5: Owner Age (most complex) (require at least two "under 50" identifiers to disqualify, unless one is strong)
Find education and/or work history from LinkedIn profile via PhantomBuster
Analyse LinkedIn profile pic with Azure Face API (free for us)
Google search for news articles/bios of founder (John Doe, 61, founded the company...)
Check Domain registration (>15 years, likely old owner)
Analyse website text w/ ChatGPT

We will use a confidence score for each criteria, ie 
"90% likely they have a product not a service"
"85% chance the owner is 50 or older"

Compile final list and rank by combined confidence scores in each category.

## 🧬 Problem
User only has a **company name**. The goal is to:
- Automatically find the company's website
	-Easy
- Scrape website text
	-Easy
- Analyze using AI (GPT)
	-Easy
- Enrich with LinkedIn, funding, and owner info
	-UNKNOWN if possible
- Estimate if owner is 50+
	-UNKNOWN if easy/hard
- Output structured results into Airtable or Google Sheets with a final filter: "Good Candidate?"

---

## ⚙️ Step-by-Step Workflow

### ✅ Step 1: Company Name ➝ Website URL
- Use tools like **Clay**, **PhantomBuster**, or **Clearbit** to resolve the company name to:
  - Website URL
  - LinkedIn URL
  - Crunchbase profile (optional)

> 🔍 Clay is ideal: input company name, get enriched results including domain + profiles

---

### ✅ Step 2: Scrape Website Text
- Use:
  - **Clay** for basic homepage text
  - **Mercury Parser API** for clean, article-style scraping
  - **Browserless.io** or **Make.com HTTP module** for advanced scraping
- Extract:
  - Homepage
  - /about, /product, /team pages

---

### ✅ Step 3: AI Classification with GPT
- Use **Make.com OpenAI module** with prompt:
```
Here is text from a company website.

Questions:
1. Is this a product company, or a service company?
2. Is the product used in a boring/stable vertical market?
3. Is there any mention of VC or outside investment?
```
- Parse responses into structured YES/NO fields:
  - `IsProduct`
  - `IsVertical`
  - `HasVC`

---

### ✅ Step 4: Enrich Further
- Use **Clay** or **PhantomBuster** to:
  - Get LinkedIn employee count
  - Identify founder or CEO
  - Get LinkedIn profile photo
- Use **Face++** or **Azure Face API** via **Make.com HTTP module** to:
  - Estimate owner age from photo
  - Save result to `Owner50+` column

---

### ✅ Step 5: Output to Airtable or Google Sheet
- Each company becomes a row with:
  - Name, Website, LinkedIn
  - `IsProduct`, `IsVertical`, `HasVC`, `Owner50+`, `EmployeeCount`
  - Derived column: `Good Candidate?` = TRUE if all above are TRUE

---

## 📈 Scaling Behavior
- **Trigger**: New company name added to Airtable
- **Make.com** processes one row at a time with delay module
- Scales smoothly to thousands of rows over hours or days

---

## 🛠️ Tool Summary

| Function                     | Tool(s)                                       |
|------------------------------|-----------------------------------------------|
| Name ➝ Website/LinkedIn     | **Clay**, **Clearbit**, **PhantomBuster**     |
| Scraping website             | **Clay**, **Browserless**, **Mercury Parser**, **Make HTTP module** |
| GPT analysis                 | **Make + OpenAI**                             |
| Owner age from photo         | **Face++ API**, **Azure Face API**, via Make  |
| Workflow automation          | **Make.com**                                  |
| Storage                      | **Airtable**, **Google Sheets**               |

---

## ⚠️ Challenges
- Rate limits (LinkedIn, GPT)
- Privacy concerns for image-based age detection
- Proxies or captchas needed for deep scraping
- Clay/Make may require paid plans to scale

---

## ✅ What the User Does
1. Uploads 10,000 company names into Airtable
2. Make scenario processes companies one-by-one
3. User reviews output and filters by `Good Candidate? == TRUE`

---

## 🔁 Optional Automation Enhancements
- Auto-email best candidates
- Schedule daily/weekly batch runs
- Add a manual override column for reviewer feedback

---

Let me know if you'd like:
- A visual diagram of the system
- Airtable schema template
- Make.com scenario template
