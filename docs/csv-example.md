# CSV and Data Structure Examples

## Sample CSV Format

The application needs to handle CSV files with varying structures. Here's an example of what the CSV might look like:

```csv
Company,First Name,Last Name,Title,Website,Company Linkedin Url,City,State,Country,Annual Revenue,Technologies
STN Solutions INC,Tugba,Coskun,Owner,stnsolutions.com,linkedin.com/company/stn-solutions-inc,San Diego,California,United States,11362000,Microsoft Office 365
Attra a Synechron Company,Sandy,Guderyon,Owner,attra.com,linkedin.com/company/attra,Pleasanton,California,United States,3000000,Microsoft Azure
FirstWatch,Daniel,Brown,Product Solutions Owner,firstwatch.net,linkedin.com/company/firstwatch,Temecula,California,United States,23389000,Sendgrid
Bay Reprographic & Supply,Doug,Dimick,President,bayplotter.com,linkedin.com/company/bay-reprographic-&-supply-inc,Redwood City,California,United States,10892000,Google Apps
```

## Current Company Structure

The current implementation uses a flat structure:

```javascript
// Current company structure
{
    companyName: "STN Solutions INC",
    website: "stnsolutions.com",
    owner: "Tugba Coskun",
    title: "Owner", 
    location: "San Diego, California, United States",
    employeeCount: 95,  // Estimated from revenue
    linkedinUrl: "linkedin.com/company/stn-solutions-inc"
}
```

## New Company Structure

The new implementation should use a flexible structure with dynamic fields:

```javascript
// New company structure
{
    id: "co_1684259386",
    name: "STN Solutions INC",
    profile: {
        // All original CSV fields preserved
        "Company": "STN Solutions INC",
        "First Name": "Tugba",
        "Last Name": "Coskun",
        "Title": "Owner",
        "Website": "stnsolutions.com",
        "Company Linkedin Url": "linkedin.com/company/stn-solutions-inc",
        "City": "San Diego",
        "State": "California",
        "Country": "United States",
        "Annual Revenue": "11362000",
        "Technologies": "Microsoft Office 365"
    },
    research: {
        status: "in_progress",
        lastUpdated: "2023-05-18T14:30:00Z",
        answers: {
            "q1": {
                answer: "YES",
                evidence: "STN Solutions sells software products for network management.",
                confidence: "HIGH",
                timestamp: "2023-05-18T14:30:00Z"
            },
            "q2": {
                answer: "Tugba Coskun",
                evidence: "According to LinkedIn and company website, Tugba Coskun is the owner.",
                confidence: "HIGH",
                timestamp: "2023-05-18T14:32:00Z"
            }
        }
    }
}
```

## Research Question Examples

```javascript
// Questions with dependencies
[
    {
        id: "q1",
        text: "Does the company sell a software product or products?",
        positiveAnswer: "YES",
        note: "Check the company's website first. The company selling software development services doesn't count as a product.",
        dependencies: []
    },
    {
        id: "q2",
        text: "Who is the president or owner of the company?",
        positiveAnswer: "NAME",
        note: "Look for leadership information",
        dependencies: []
    },
    {
        id: "q3",
        text: "Is the owner of the company at least 50 years old?",
        positiveAnswer: "YES",
        note: "Check radaris",
        dependencies: ["q2"] // Depends on knowing owner name first
    }
]
```

## API Response Examples

### Company List Response

```json
{
    "success": true,
    "data": [
        {
            "id": "co_1684259386",
            "name": "STN Solutions INC",
            "profile": {
                "Website": "stnsolutions.com",
                "City": "San Diego",
                "State": "California"
            },
            "research": {
                "status": "in_progress",
                "completedQuestions": 2,
                "totalQuestions": 7
            }
        },
        {
            "id": "co_1684259387",
            "name": "Attra a Synechron Company",
            "profile": {
                "Website": "attra.com",
                "City": "Pleasanton",
                "State": "California"
            },
            "research": {
                "status": "disqualified",
                "completedQuestions": 3,
                "totalQuestions": 7
            }
        }
    ],
    "pagination": {
        "total": 100,
        "page": 1,
        "pageSize": 25
    }
}
```

### Research Response

```json
{
    "success": true,
    "data": {
        "companyId": "co_1684259386",
        "companyName": "STN Solutions INC",
        "questionId": "q2",
        "question": "Who is the president or owner of the company?",
        "result": {
            "answer": "Tugba Coskun",
            "evidence": "According to LinkedIn and company website, Tugba Coskun is the owner.",
            "confidence": "HIGH"
        },
        "claudeResponse": "Based on my research, the owner of STN Solutions, INC is Tugba Coskun...",
        "usage": {
            "input_tokens": 320,
            "output_tokens": 450
        }
    }
}
```