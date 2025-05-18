// DOM elements
const startBtn = document.getElementById('start-btn');
const terminalOutput = document.getElementById('terminal-output');
const terminalInput = document.getElementById('terminal-input');
const loadingSpinner = document.getElementById('loading-spinner');
const resultsSection = document.getElementById('results-section');
const resultsBody = document.getElementById('results-body');
const questionItems = document.querySelectorAll('.question-item');
const questionList = document.getElementById('question-list');
const companyDataTable = document.getElementById('company-data-table');
const companyDataTbody = document.getElementById('company-data-tbody');

// Mock company data
const mockCompanies = [
    {
        companyName: "Acme Software Solutions",
        owner: "John Smith",
        title: "CEO",
        location: "Portland, OR",
        website: "acmesoftware.com",
        employeeCount: 22,
        linkedinUrl: "linkedin.com/company/acme-software"
    },
    {
        companyName: "DataMaster Inc.",
        owner: "Sarah Johnson",
        title: "Founder",
        location: "Austin, TX",
        website: "datamaster.tech",
        employeeCount: 15,
        linkedinUrl: "linkedin.com/company/datamaster"
    },
    {
        companyName: "CloudTech Services",
        owner: "Michael Brown",
        title: "President",
        location: "Seattle, WA",
        website: "cloudtechservices.net",
        employeeCount: 35,
        linkedinUrl: "linkedin.com/company/cloudtech-services"
    },
    {
        companyName: "HealthSoft Systems",
        owner: "Jessica Williams",
        title: "CEO",
        location: "Boston, MA",
        website: "healthsoftsystems.com",
        employeeCount: 18,
        linkedinUrl: "linkedin.com/company/healthsoft"
    },
    {
        companyName: "EduTech Solutions",
        owner: "Robert Davis",
        title: "Founder & CEO",
        location: "Chicago, IL",
        website: "edutechsolutions.org",
        employeeCount: 12,
        linkedinUrl: "linkedin.com/company/edutech-solutions"
    }
];

// Mock questions (already in HTML, but duplicated here for reference)
const mockQuestions = [
    { 
        text: "Does the company sell a software product or software development services?", 
        positiveAnswer: "YES", 
        note: "Check the company's website" 
    },
    { 
        text: "Are the company's products vertical market software?", 
        positiveAnswer: "YES", 
        note: "Check the company's website" 
    },
    { 
        text: "Is the owner of the company at least 50 years old?", 
        positiveAnswer: "YES", 
        note: "Check radaris" 
    },
    { 
        text: "Does the company number between 5 and 40 employees?", 
        positiveAnswer: "YES", 
        note: "" 
    },
    { 
        text: "Is the company bootstrapped?", 
        positiveAnswer: "YES", 
        note: "If there's no indication of VC/PE funding, assume the company is bootstrapped" 
    },
    { 
        text: "Are the majority of the employees based in the USA?", 
        positiveAnswer: "YES", 
        note: "Check zoominfo" 
    }
];

// Mock research responses
const mockResearchResponses = {
    "Acme Software Solutions": [
        {
            answer: "YES",
            confidence: "High",
            evidence: "The company's website clearly states they offer multiple software products targeting small businesses.",
            fullResponse: "I've examined Acme Software Solutions' website at acmesoftware.com. The company clearly markets several software products including accounting software, inventory management systems, and CRM tools. There's no indication they offer custom software development services. Their 'Products' page lists their software offerings with pricing and features, confirming they are primarily a product company.\n\nBased on this evidence, I can confidently conclude that Acme Software Solutions sells software products rather than development services."
        },
        {
            answer: "YES",
            confidence: "Medium",
            evidence: "Their products focus specifically on accounting and inventory management for retail businesses.",
            fullResponse: "After reviewing Acme Software Solutions' product offerings on their website, I can see that they focus on specialized software for retail businesses. Their accounting software has retail-specific features like point-of-sale integration, and their inventory management system is designed specifically for retail operations with features like barcode scanning and stock level alerts for retail environments.\n\nThis indicates they produce vertical market software tailored to a specific industry (retail) rather than horizontal market software that would serve broader business functions across many industries."
        },
        {
            answer: "YES",
            confidence: "Medium",
            evidence: "According to public records, John Smith was born in 1968, making him 57 years old.",
            fullResponse: "I searched for information about John Smith, the CEO of Acme Software Solutions, on public records databases. According to Radaris, there is a John Smith associated with this company who was born in 1968, which would make him approximately 57 years old currently.\n\nThis information is consistent across multiple public records sources, giving me medium confidence in this answer."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Company profile indicates 22 employees, within the 5-40 range.",
            fullResponse: "According to the company data, Acme Software Solutions has 22 employees. This employee count falls within the specified range of 5-40 employees.\n\nThis information is directly confirmed from the company's LinkedIn profile and business registrations, giving me high confidence in this answer."
        },
        {
            answer: "YES",
            confidence: "Medium",
            evidence: "No mention of VC funding, and company history suggests it was self-funded from the beginning.",
            fullResponse: "I've researched Acme Software Solutions' funding history and found no evidence of venture capital or private equity investment. The company's 'About Us' page mentions that John Smith founded the company in 2005 with personal savings and grew it organically through reinvesting profits.\n\nThere are no press releases about funding rounds, no mentions on VC portfolio sites, and no SEC filings that would indicate external investment. Based on these findings and the standard assumption that companies without clear evidence of external funding are bootstrapped, I conclude that Acme Software Solutions is bootstrapped."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Company headquarters and all operations are based in Portland, OR with no offshore teams.",
            fullResponse: "I've reviewed Acme Software Solutions' employee information on ZoomInfo and LinkedIn. The company's headquarters is in Portland, Oregon, and employee profiles indicate that all team members are based in the United States, primarily in Portland with a few remote employees in other US cities.\n\nThere's no indication of international offices or offshore development teams. Company job postings also specify US-based positions. Based on this evidence, I can confidently state that the majority (in fact, all) of the employees are based in the USA."
        }
    ],
    "DataMaster Inc.": [
        {
            answer: "YES",
            confidence: "High",
            evidence: "The company offers several data management products with fixed pricing tiers.",
            fullResponse: "After examining DataMaster Inc.'s website (datamaster.tech), I can confirm they are a product company. They offer several data management software products including DataMaster Analytics, DataMaster Warehouse, and DataMaster Cleanse.\n\nEach product has clearly defined pricing tiers and feature sets characteristic of software products. While they do offer implementation services, these are specifically for their products and not general software development services.\n\nBased on this evidence, DataMaster Inc. clearly sells software products rather than development services."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Their products specifically target the healthcare data management sector.",
            fullResponse: "Looking at DataMaster Inc.'s product descriptions and marketing materials, I can see that their software solutions are specifically designed for healthcare data management. Their software includes features like HIPAA compliance tools, medical coding validation, and healthcare-specific analytics.\n\nTheir case studies exclusively feature healthcare organizations like hospitals, clinics, and insurance providers. The company explicitly markets itself as a healthcare data solution.\n\nThis specialized focus on a single industry vertical (healthcare) clearly indicates that DataMaster Inc. produces vertical market software."
        },
        {
            answer: "NO",
            confidence: "High",
            evidence: "Public records show Sarah Johnson was born in 1985, making her 40 years old.",
            fullResponse: "I searched for information about Sarah Johnson, the founder of DataMaster Inc., using Radaris and other public records sources. According to these records, Sarah Johnson was born in 1985, which would make her approximately 40 years old.\n\nThis information appears consistent across multiple sources, including her LinkedIn profile which mentions she graduated college in 2007, which aligns with someone born around 1985.\n\nSince Sarah Johnson is 40 years old, she does not meet the criteria of being at least 50 years old."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Company has 15 employees according to LinkedIn and ZoomInfo.",
            fullResponse: "Based on the company data provided, DataMaster Inc. has 15 employees. This falls within the specified range of 5-40 employees.\n\nThis information is consistent with their LinkedIn company page and ZoomInfo listing. The company appears to be a small but established operation with a focused team."
        },
        {
            answer: "NO",
            confidence: "High",
            evidence: "Company received Series A funding of $2.5M in 2021 from TechVentures Capital.",
            fullResponse: "In researching DataMaster Inc.'s funding history, I found a press release from May 2021 announcing that the company secured $2.5 million in Series A funding from TechVentures Capital.\n\nThe funding announcement mentioned that the investment would be used to expand their healthcare data management platform and grow their sales team. Prior to this, the company had been operating on seed funding of $500,000 from angel investors in 2019.\n\nSince DataMaster Inc. has received venture capital funding, it is not bootstrapped."
        },
        {
            answer: "YES",
            confidence: "Medium",
            evidence: "Company has offices in Austin, TX and all team members appear to be US-based.",
            fullResponse: "According to ZoomInfo and LinkedIn data, DataMaster Inc. is headquartered in Austin, Texas, with no international offices listed. Employee profiles on LinkedIn show team members located in various US cities including Austin, Dallas, and remote workers in California and Colorado.\n\nJob postings from the company specify US-based positions, and their website mentions their US-based customer support team. I found no evidence of offshore employees or international operations.\n\nBased on this information, it appears that the majority (likely all) of DataMaster Inc.'s employees are based in the USA."
        }
    ],
    "CloudTech Services": [
        {
            answer: "NO",
            confidence: "High",
            evidence: "The company primarily offers custom cloud development services rather than packaged products.",
            fullResponse: "After reviewing CloudTech Services' website (cloudtechservices.net), I found that they primarily offer cloud development and integration services rather than software products.\n\nTheir main offerings include custom cloud solution development, migration services, DevOps consulting, and cloud architecture design. These are described as services with consultation and custom pricing rather than packaged products.\n\nWhile they do mention some proprietary tools they use during implementation, these are not marketed as standalone products that customers can purchase. Based on this evidence, CloudTech Services does not sell software products but instead offers software development services."
        },
        {
            answer: "NO",
            confidence: "High",
            evidence: "Not applicable as they don't sell products, but their services span multiple industries.",
            fullResponse: "Since CloudTech Services doesn't sell software products but rather offers development services, this question isn't directly applicable in the typical sense. However, examining their service offerings and clientele provides relevant insight.\n\nTheir website showcases case studies from diverse industries including finance, healthcare, retail, manufacturing, and education. Their cloud services are described as adaptable to various business needs rather than tailored to a specific vertical market.\n\nThis indicates they are a general cloud services provider rather than one focused on vertical market solutions. They do not qualify as a vertical market software company."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Public records indicate Michael Brown was born in 1970, making him 55 years old.",
            fullResponse: "I searched for information about Michael Brown, the President of CloudTech Services, using Radaris and other public records databases. According to these sources, Michael Brown was born in 1970, which would make him approximately 55 years old.\n\nThis information is corroborated by his professional history, which shows he's been working in the technology sector since the early 1990s, consistent with someone in their mid-50s.\n\nBased on this evidence, Michael Brown is at least 50 years old, meeting this criterion."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "The company has 35 employees according to company data.",
            fullResponse: "According to the company data provided, CloudTech Services has 35 employees. This falls within the specified range of 5-40 employees, though at the higher end of the range.\n\nThis information is consistent with their LinkedIn company profile and business registrations. The company appears to be a well-established small business with a substantial team."
        },
        {
            answer: "NO",
            confidence: "High",
            evidence: "Company received $5M in Series A funding in 2020 and another $8M in Series B in 2022.",
            fullResponse: "In researching CloudTech Services' funding history, I found clear evidence that they are not bootstrapped. According to TechCrunch articles and press releases, the company received $5 million in Series A funding in 2020 from Innovation Capital Partners.\n\nAdditionally, they secured a Series B round of $8 million in 2022 led by CloudVentures with participation from their previous investors. Their CEO Michael Brown is quoted in these announcements discussing how the funding would accelerate their growth plans.\n\nThis funding history clearly establishes that CloudTech Services is venture-backed rather than bootstrapped."
        },
        {
            answer: "NO",
            confidence: "Medium",
            evidence: "Company has a significant development team in India comprising about 40% of their workforce.",
            fullResponse: "Based on ZoomInfo data and LinkedIn employee profiles for CloudTech Services, the company appears to have a mixed workforce with locations in both the US and internationally.\n\nTheir headquarters is in Seattle, WA, with approximately 60% of employees based in various US locations. However, they also maintain a significant development office in Bangalore, India, where approximately 40% of their technical staff is located.\n\nSince a substantial portion (40%) of their employees are based outside the USA, it cannot be said that the majority of employees are US-based, though it's relatively close to an even split."
        }
    ],
    "HealthSoft Systems": [
        {
            answer: "YES",
            confidence: "High",
            evidence: "The company sells electronic health record and practice management software products.",
            fullResponse: "After examining HealthSoft Systems' website (healthsoftsystems.com), I can confirm they are primarily a product company. They offer a suite of healthcare software products including HealthSoft EHR (Electronic Health Records), HealthSoft PM (Practice Management), HealthSoft Portal (Patient Portal), and HealthSoft Analytics.\n\nEach product has distinct features, specifications, and pricing tiers. While they do offer implementation and training services, these are specifically for their software products rather than custom development services.\n\nBased on this evidence, HealthSoft Systems clearly sells software products rather than development services."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Their products are specifically designed for healthcare providers and medical practices.",
            fullResponse: "HealthSoft Systems' product line is exclusively focused on the healthcare industry. Their electronic health record system, practice management software, patient portal, and analytics tools are all specifically designed for medical practices and healthcare providers.\n\nTheir software includes features like medical billing integration, clinical documentation templates, HIPAA compliance tools, and healthcare-specific reporting. They market exclusively to healthcare organizations and their case studies feature only medical practices, clinics, and hospitals.\n\nThis clear specialization in solutions for a specific industry (healthcare) definitively qualifies their products as vertical market software."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Public records show Jessica Williams was born in 1968, making her 57 years old.",
            fullResponse: "I searched for information about Jessica Williams, the CEO of HealthSoft Systems, using Radaris and other public records databases. According to these sources, Jessica Williams was born in 1968, which would make her approximately 57 years old.\n\nThis information is consistent with her professional history, which shows she completed her education in the late 1980s and has over 30 years of industry experience, which aligns with someone in their late 50s.\n\nBased on this evidence, Jessica Williams is at least 50 years old, meeting this criterion."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Company has 18 employees according to LinkedIn and company data.",
            fullResponse: "According to the company data provided, HealthSoft Systems has 18 employees. This falls within the specified range of 5-40 employees.\n\nThis information is consistent with their LinkedIn company profile and business registrations. The company appears to be a small but established operation with a focused team dedicated to their healthcare software solutions."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "No evidence of external funding; company history states it was founded with personal investment.",
            fullResponse: "In researching HealthSoft Systems' funding history, I found no evidence of venture capital or private equity investment. The company's 'About Us' page explicitly mentions that Jessica Williams founded the company in 2003 with personal funds and has grown it organically through reinvesting profits.\n\nThere are no press releases about funding rounds, no mentions on VC portfolio sites, and no SEC filings that would indicate external investment. The company also proudly emphasizes their independence and long-term focus in their marketing materials.\n\nBased on these findings, I can confidently conclude that HealthSoft Systems is bootstrapped."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "All employees are based in the Boston headquarters with a few remote workers in other US states.",
            fullResponse: "According to ZoomInfo data and LinkedIn employee profiles for HealthSoft Systems, all of their employees appear to be based in the United States. The company is headquartered in Boston, MA, where most of their staff works, with a few remote employees in other US states.\n\nTheir job postings are all for US-based positions, and they don't advertise any international offices or teams. Their customer support team is also advertised as US-based.\n\nBased on this evidence, I can confidently state that the majority (in fact, all) of HealthSoft Systems' employees are based in the USA."
        }
    ],
    "EduTech Solutions": [
        {
            answer: "YES",
            confidence: "High",
            evidence: "The company offers several education management software products with fixed pricing.",
            fullResponse: "After examining EduTech Solutions' website (edutechsolutions.org), I can confirm they are a product company. They offer several software products for educational institutions, including EduTech LMS (Learning Management System), EduTech SIS (Student Information System), and EduTech Analytics.\n\nEach product has distinct features and pricing tiers based on institution size and requirements. While they do offer implementation and training services, these are specifically for their software products rather than custom development work.\n\nBased on this evidence, EduTech Solutions clearly sells software products rather than development services."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Their products specifically target the education sector with specialized features.",
            fullResponse: "EduTech Solutions' entire product line is focused exclusively on the education sector. Their learning management system, student information system, and analytics platform are all designed specifically for educational institutions with features like curriculum management, attendance tracking, grade management, and education-specific reporting.\n\nTheir marketing materials, case studies, and testimonials all come from schools, colleges, and educational organizations. They don't appear to serve any industries outside of education.\n\nThis clear specialization in solutions for a specific industry (education) definitively qualifies their products as vertical market software."
        },
        {
            answer: "NO",
            confidence: "High",
            evidence: "Public records show Robert Davis was born in 1980, making him 45 years old.",
            fullResponse: "I searched for information about Robert Davis, the Founder & CEO of EduTech Solutions, using Radaris and other public records databases. According to these sources, Robert Davis was born in 1980, which would make him approximately 45 years old.\n\nThis information is consistent with his LinkedIn profile, which shows he graduated college in the early 2000s and founded EduTech Solutions in 2010 after several years in the education technology field.\n\nSince Robert Davis is 45 years old, he does not meet the criteria of being at least 50 years old."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Company has 12 employees according to company data.",
            fullResponse: "According to the company data provided, EduTech Solutions has 12 employees. This falls within the specified range of 5-40 employees.\n\nThis information is consistent with their LinkedIn company profile and business registrations. The company appears to be a small but established operation with a focused team dedicated to their educational software solutions."
        },
        {
            answer: "YES",
            confidence: "Medium",
            evidence: "No evidence of external funding found; company appears to be self-funded.",
            fullResponse: "In researching EduTech Solutions' funding history, I found no evidence of venture capital or private equity investment. There are no press releases about funding rounds, no mentions on VC portfolio sites, and no SEC filings that would indicate external investment.\n\nThe company's website mentions that Robert Davis founded the company in 2010 based on his experience working in education technology, but doesn't specifically discuss funding. However, given the absence of any evidence of external funding and the company's relatively small size despite being in business for over a decade, it appears to be bootstrapped.\n\nFollowing the guideline that companies without clear indication of VC/PE funding can be assumed to be bootstrapped, I conclude that EduTech Solutions is likely bootstrapped."
        },
        {
            answer: "YES",
            confidence: "High",
            evidence: "Company is based in Chicago with all employees located in the US.",
            fullResponse: "According to ZoomInfo data and LinkedIn employee profiles for EduTech Solutions, all of their employees appear to be based in the United States. The company is headquartered in Chicago, IL, with some remote employees in other US states.\n\nTheir careers page only lists US-based positions, and they don't mention any international offices or teams on their website. Their support team is also advertised as being based in the US with US business hours.\n\nBased on this evidence, I can confidently state that the majority (in fact, all) of EduTech Solutions' employees are based in the USA."
        }
    ]
};

// Single source of truth for investigation state
const investigationState = {
    companies: mockCompanies,
    questions: mockQuestions,
    selectedQuestionIndex: 0,
    currentCompanyIndex: 0,
    waitingForUserInput: false,
    results: [],
    selectedColumnIndex: 1, // Default to Q1: Product column (index 1)
    selectedCellCompanyIndex: -1, // No specific cell selected by default
    mode: 'column' // 'column' or 'cell' - determines whether we research entire column or single cell
};

// Add text to the terminal output
function appendToTerminal(text) {
    terminalOutput.innerHTML += "\n\n" + text;
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Select a question for research
function selectQuestion(questionIndex) {
    // Update the UI to show the selected question in the hidden list
    questionItems.forEach(item => {
        item.classList.remove('selected');
        if (parseInt(item.dataset.questionIndex) === questionIndex) {
            item.classList.add('selected');
        }
    });
    
    // Update the state with selected question
    investigationState.selectedQuestionIndex = questionIndex;
    
    // Show the selection in the terminal
    if (investigationState.questions.length > 0) {
        appendToTerminal(`\nSelected question: ${investigationState.questions[questionIndex].text}`);
    }
    
    // Also highlight the corresponding column in the table
    highlightSelectedColumn(questionIndex + 1); // Convert to 1-based column index
}

// Handle user input (Enter key to continue)
terminalInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        if (investigationState.waitingForUserInput) {
            investigationState.waitingForUserInput = false;
            terminalInput.style.display = 'none';
            
            // Process the next step in the investigation
            if (terminalInput.dataset.action === 'research') {
                try {
                    appendToTerminal("\nProcessing research request...");
                    
                    // Get the company and question indices
                    const companyIndex = parseInt(terminalInput.dataset.companyIndex);
                    const questionIndex = parseInt(terminalInput.dataset.questionIndex);
                    
                    // Simulate research delay
                    loadingSpinner.style.display = 'block';
                    
                    setTimeout(() => {
                        loadingSpinner.style.display = 'none';
                        
                        // Get mock research results
                        const company = investigationState.companies[companyIndex];
                        const question = investigationState.questions[questionIndex];
                        const mockResponse = mockResearchResponses[company.companyName][questionIndex];
                        
                        // Display the results
                        appendToTerminal(`\nResearch Results:\n${mockResponse.fullResponse}`);
                        appendToTerminal(`\nFinal Answer: ${mockResponse.answer}`);
                        appendToTerminal(`Confidence: ${mockResponse.confidence}`);
                        
                        if (mockResponse.evidence) {
                            appendToTerminal(`Evidence: ${mockResponse.evidence}`);
                        }
                        
                        // Display token usage (mock)
                        appendToTerminal(`\nToken Usage: 1245 input, 876 output`);
                        
                        // Update the investigation results
                        if (!investigationState.results[companyIndex]) {
                            investigationState.results[companyIndex] = {
                                companyName: company.companyName,
                                answers: Array(investigationState.questions.length).fill(null),
                                status: 'In Progress'
                            };
                        }
                        
                        investigationState.results[companyIndex].answers[questionIndex] = mockResponse.answer;
                        investigationState.results[companyIndex].status = mockResponse.answer !== question.positiveAnswer ? 
                            'Disqualified' : 
                            (questionIndex === investigationState.questions.length - 1 ? 'Qualified' : 'In Progress');
                        
                        // If negative answer, indicate disqualification
                        if (mockResponse.answer !== question.positiveAnswer) {
                            appendToTerminal(`\n${company.companyName} has been disqualified due to a negative answer.`);
                        }
                        
                        // Move to the next company
                        const nextStep = moveToNextCompany();
                        
                        // If we've completed all companies for this question, finish
                        if (nextStep.completedQuestion) {
                            finishInvestigation();
                            return;
                        }
                        
                        // Slight delay before continuing
                        setTimeout(() => {
                            continueInvestigation();
                        }, 1000);
                        
                    }, 2000); // Simulate 2 second delay for research
                    
                } catch (error) {
                    appendToTerminal(`\nError during research: ${error.message}`);
                    appendToTerminal("\nPlease try again or restart the investigation.");
                    
                    // Re-enable input
                    investigationState.waitingForUserInput = true;
                    terminalInput.style.display = 'block';
                    terminalInput.focus();
                }
            }
        }
    }
});

// Move to next company for the current question
function moveToNextCompany() {
    // Increment company index
    investigationState.currentCompanyIndex++;
    
    // Check if we've gone through all companies for this question
    if (investigationState.currentCompanyIndex >= investigationState.companies.length) {
        // Reset to first company
        investigationState.currentCompanyIndex = 0;
        
        // We've finished the question with all companies
        return {
            nextCompanyIndex: 0,
            nextQuestionIndex: investigationState.selectedQuestionIndex,
            isDone: false,
            completedQuestion: true
        };
    }
    
    return {
        nextCompanyIndex: investigationState.currentCompanyIndex,
        nextQuestionIndex: investigationState.selectedQuestionIndex,
        isDone: false,
        completedQuestion: false
    };
}

// Finish the investigation
function finishInvestigation() {
    appendToTerminal("\n\nInvestigation complete! See the results table below.");
    
    // Show the results section
    resultsSection.classList.remove('hidden');
    
    // Clear previous results
    resultsBody.innerHTML = '';
    
    // Populate the results table
    investigationState.results.forEach(result => {
        if (!result) return; // Skip empty results
        
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${result.companyName}</td>
            <td>${result.answers[0] || '-'}</td>
            <td>${result.answers[1] || '-'}</td>
            <td>${result.answers[2] || '-'}</td>
            <td>${result.answers[3] || '-'}</td>
            <td>${result.answers[4] || '-'}</td>
            <td>${result.answers[5] || '-'}</td>
            <td>${result.status}</td>
        `;
        
        resultsBody.appendChild(row);
    });
    
    // Reset the state for a new investigation
    investigationState.currentCompanyIndex = 0;
    investigationState.waitingForUserInput = false;
    // Keep selectedQuestionIndex intact for next investigation
    
    // Enable the start button
    startBtn.disabled = false;
    startBtn.textContent = "Start New Investigation";
}

// Continue the investigation
function continueInvestigation() {
    // If we're in cell mode, only research that specific company/question pair
    if (investigationState.mode === 'cell') {
        // If we've already processed the cell, we're done
        if (
            investigationState.results[investigationState.selectedCellCompanyIndex] && 
            investigationState.results[investigationState.selectedCellCompanyIndex].answers[investigationState.selectedQuestionIndex]
        ) {
            finishInvestigation();
            return;
        }
        
        const company = investigationState.companies[investigationState.selectedCellCompanyIndex];
        const question = investigationState.questions[investigationState.selectedQuestionIndex];
        
        appendToTerminal(`\n\nI'm going to research ${company.companyName} to answer: ${question.text}`);
        appendToTerminal("\nI'll need to use Claude to perform the research. May I proceed?");
        
        // Wait for user input to continue
        investigationState.waitingForUserInput = true;
        terminalInput.style.display = 'block';
        terminalInput.value = '';
        terminalInput.focus();
        terminalInput.dataset.action = 'research';
        terminalInput.dataset.companyIndex = investigationState.selectedCellCompanyIndex;
        terminalInput.dataset.questionIndex = investigationState.selectedQuestionIndex;
        return;
    }
    
    // Column mode - process all companies for the selected question
    
    // Skip disqualified companies
    if (
        investigationState.currentCompanyIndex < investigationState.companies.length && 
        investigationState.results[investigationState.currentCompanyIndex] && 
        investigationState.results[investigationState.currentCompanyIndex].status === "Disqualified"
    ) {
        // Skip this company by moving to next
        const nextStep = moveToNextCompany();
        
        if (nextStep.completedQuestion) {
            finishInvestigation();
            return;
        }
        
        // Continue with next company
        continueInvestigation();
        return;
    }
    
    // If we've gone through all companies, we're done
    if (investigationState.currentCompanyIndex >= investigationState.companies.length) {
        finishInvestigation();
        return;
    }
    
    const company = investigationState.companies[investigationState.currentCompanyIndex];
    const question = investigationState.questions[investigationState.selectedQuestionIndex];
    
    appendToTerminal(`\n\nI'm going to research ${company.companyName} to answer: ${question.text}`);
    appendToTerminal("\nI'll need to use Claude to perform the research. May I proceed?");
    
    // Wait for user input to continue
    investigationState.waitingForUserInput = true;
    terminalInput.style.display = 'block';
    terminalInput.value = '';
    terminalInput.focus();
    terminalInput.dataset.action = 'research';
    terminalInput.dataset.companyIndex = investigationState.currentCompanyIndex;
    terminalInput.dataset.questionIndex = investigationState.selectedQuestionIndex;
}

// Reset investigation state
function resetInvestigation() {
    // Reset local state only
    investigationState.currentCompanyIndex = 0;
    investigationState.results = [];
    // Do not reset selectedQuestionIndex - keep user's selection
    
    // Return a resolved promise for compatibility
    return Promise.resolve({ message: 'Investigation reset successfully' });
}

// Start the investigation process
startBtn.addEventListener('click', function() {
    try {
        // Reset for a new investigation
        terminalOutput.innerHTML = "Starting investigation process...";
        resultsSection.classList.add('hidden');
        
        // Disable the start button
        startBtn.disabled = true;
        
        // Reset the investigation state
        resetInvestigation();
        
        // Load mock data
        appendToTerminal(`\nLoaded ${investigationState.companies.length} companies from data file.`);
        appendToTerminal(`\nLoaded ${investigationState.questions.length} questions.`);
        
        appendToTerminal("\nHello, I'm Claude! I'm going to help you research companies based on the criteria you've specified.");
        
        // Get the selected question
        const selectedQuestion = investigationState.questions[investigationState.selectedQuestionIndex];
        
        if (investigationState.mode === 'cell') {
            // We're researching a specific company for a specific question
            const company = investigationState.companies[investigationState.selectedCellCompanyIndex];
            
            appendToTerminal(`\nI'll be researching a specific company: ${company.companyName}`);
            appendToTerminal(`For question #${investigationState.selectedQuestionIndex + 1}:`);
            appendToTerminal(`"${selectedQuestion.text}"`);
        } else {
            // We're researching all companies for a specific question
            appendToTerminal(`\nI'll be analyzing ${investigationState.companies.length} companies, focusing on question #${investigationState.selectedQuestionIndex + 1}:`);
            appendToTerminal(`"${selectedQuestion.text}"`);
        }
        
        appendToTerminal("\nPress Enter when prompted to proceed with each step of the investigation.");
        
        // Only default to first question if none is already selected
        if (!document.querySelector('.question-item.selected')) {
            selectQuestion(0);
        }
        
        // Start the investigation
        continueInvestigation();
    } catch (error) {
        appendToTerminal(`Error starting investigation: ${error.message}`);
        startBtn.disabled = false;
    }
});

// This function is no longer needed since we're using column headers for selection
// But we'll keep it for backwards compatibility
questionList.addEventListener('click', function(event) {
    let questionItem = event.target.closest('.question-item');
    if (questionItem) {
        const questionIndex = parseInt(questionItem.dataset.questionIndex);
        if (!isNaN(questionIndex) && questionIndex >= 0 && questionIndex < 6) {
            selectQuestion(questionIndex);
            // Also highlight the corresponding column
            highlightSelectedColumn(questionIndex + 1); // Convert to 1-based column index
        }
    }
});

// Function to populate the company data table
function populateCompanyDataTable() {
    // Clear existing data
    companyDataTbody.innerHTML = '';
    
    // Loop through the mock company data
    mockCompanyData.forEach((company, index) => {
        const row = document.createElement('tr');
        row.dataset.companyIndex = index;
        
        // Add all cells
        row.innerHTML = `
            <td>${company.company}</td>
            <td class="question-cell" data-question-index="0" data-company-index="${index}">${company.softwareProduct || '-'}</td>
            <td class="question-cell" data-question-index="1" data-company-index="${index}">${company.verticalMarket || '-'}</td>
            <td class="question-cell" data-question-index="2" data-company-index="${index}">${company.ownerAge || '-'}</td>
            <td class="question-cell" data-question-index="3" data-company-index="${index}">${company.employees || '-'}</td>
            <td class="question-cell" data-question-index="4" data-company-index="${index}">${company.usEmployees || '-'}</td>
            <td class="question-cell" data-question-index="5" data-company-index="${index}">${company.bootstrapped || '-'}</td>
            <td>${company.domain}</td>
            <td>${company.linkedin}</td>
            <td>${company.contact}</td>
            <td>${company.contactPosition}</td>
        `;
        
        companyDataTbody.appendChild(row);
    });
    
    // Add click event listeners to question cells
    const questionCells = document.querySelectorAll('.question-cell');
    questionCells.forEach(cell => {
        cell.addEventListener('click', (e) => {
            const questionIndex = parseInt(cell.dataset.questionIndex);
            const companyIndex = parseInt(cell.dataset.companyIndex);
            
            if (!isNaN(questionIndex) && !isNaN(companyIndex)) {
                // Get the column index (question index + 1 since company is column 0)
                const columnIndex = questionIndex + 1;
                
                // Highlight the cell
                highlightSelectedCell(companyIndex, columnIndex);
                
                // Update the terminal with selection info
                const company = investigationState.companies[companyIndex];
                const question = investigationState.questions[questionIndex];
                
                appendToTerminal(`\nSelected to research: ${company.companyName}`);
                appendToTerminal(`For question: ${question.text}`);
            }
        });
    });
}

// Function to highlight the selected question column
function highlightSelectedColumn(columnIndex) {
    // Clear all selections
    clearAllSelections();
    
    // Get all rows in the table
    const rows = companyDataTable.querySelectorAll('tr');
    
    // Highlight the selected column in each row
    rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        if (cells.length > columnIndex) {
            cells[columnIndex].classList.add('selected-question');
        }
    });
    
    // Update the selected question index based on the column
    // The question headers are at indexes 1-6 (0-based)
    if (columnIndex >= 1 && columnIndex <= 6) {
        investigationState.selectedQuestionIndex = columnIndex - 1; // Convert to 0-based question index
        investigationState.selectedColumnIndex = columnIndex;
        investigationState.selectedCellCompanyIndex = -1; // Reset cell selection
        investigationState.mode = 'column';
    }
}

// Function to highlight a specific cell (for specific company/question research)
function highlightSelectedCell(rowIndex, columnIndex) {
    // Clear all selections
    clearAllSelections();
    
    // Still highlight the column for context
    highlightSelectedColumn(columnIndex);
    
    // Get the specific cell and add stronger highlight
    const rows = companyDataTable.querySelectorAll('tbody tr');
    if (rows.length > rowIndex) {
        const cells = rows[rowIndex].querySelectorAll('td');
        if (cells.length > columnIndex) {
            cells[columnIndex].classList.add('selected-cell');
        }
    }
    
    // Update state
    investigationState.selectedQuestionIndex = columnIndex - 1; // Convert to 0-based question index
    investigationState.selectedColumnIndex = columnIndex;
    investigationState.selectedCellCompanyIndex = rowIndex;
    investigationState.currentCompanyIndex = rowIndex;
    investigationState.mode = 'cell';
}

// Helper function to clear all selections
function clearAllSelections() {
    const allCells = companyDataTable.querySelectorAll('th, td');
    allCells.forEach(cell => {
        cell.classList.remove('selected-question');
        cell.classList.remove('selected-cell');
    });
}

// Populate the company data table on page load
document.addEventListener('DOMContentLoaded', function() {
    populateCompanyDataTable();
    setupDragAndDropColumns();
    
    // Add click event listeners to the question column headers
    const headerRow = companyDataTable.querySelector('thead tr');
    const headers = headerRow.querySelectorAll('th');
    headers.forEach((header, index) => {
        // Only add click events to question headers (indexes 1-6)
        if (index >= 1 && index <= 6) {
            header.addEventListener('click', (e) => {
                // Prevent triggering drag start
                if (e.target === header || header.contains(e.target)) {
                    // Only process if not currently dragging
                    if (!header.classList.contains('dragging')) {
                        highlightSelectedColumn(index);
                    }
                }
            });
        }
    });
    
    // Highlight the default selected column
    highlightSelectedColumn(investigationState.selectedColumnIndex);
});

// Function to set up drag and drop for the table columns
function setupDragAndDropColumns() {
    const tableHeaders = companyDataTable.querySelectorAll('th');
    let draggedColumn = null;
    let draggedColumnIndex = -1;
    
    // Add draggable attribute to each header
    tableHeaders.forEach((header, index) => {
        header.setAttribute('draggable', 'true');
        header.dataset.columnIndex = index;
        
        // Drag start event
        header.addEventListener('dragstart', (e) => {
            draggedColumn = header;
            draggedColumnIndex = index;
            
            // Add a delay before adding the dragging class
            setTimeout(() => {
                header.classList.add('dragging');
                
                // Add visual feedback for all columns
                tableHeaders.forEach(th => {
                    if (th !== header) {
                        th.style.borderLeft = '2px dashed transparent';
                        th.style.borderRight = '2px dashed transparent';
                    }
                });
            }, 0);
            
            // Set drag data for Firefox compatibility
            e.dataTransfer.setData('text/plain', index);
            e.dataTransfer.effectAllowed = 'move';
        });
        
        // Drag end event
        header.addEventListener('dragend', () => {
            draggedColumn.classList.remove('dragging');
            tableHeaders.forEach(th => {
                th.classList.remove('drop-target');
                th.style.borderLeft = '';
                th.style.borderRight = '';
            });
            draggedColumn = null;
            draggedColumnIndex = -1;
        });
        
        // Drag over event
        header.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedColumn !== header) {
                header.classList.add('drop-target');
            }
        });
        
        // Drag leave event
        header.addEventListener('dragleave', () => {
            header.classList.remove('drop-target');
        });
        
        // Drop event
        header.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (draggedColumn === header) return;
            
            const targetIndex = parseInt(header.dataset.columnIndex);
            
            // Perform the column swap in the table
            swapTableColumns(draggedColumnIndex, targetIndex);
            
            // Clear drop target styles
            tableHeaders.forEach(th => th.classList.remove('drop-target'));
        });
    });
}

// Function to swap table columns
function swapTableColumns(fromIndex, toIndex) {
    const table = companyDataTable;
    const rows = Array.from(table.querySelectorAll('tr'));
    
    // Update the column indices
    const headers = table.querySelectorAll('th');
    headers[fromIndex].dataset.columnIndex = toIndex;
    headers[toIndex].dataset.columnIndex = fromIndex;
    
    // Loop through all rows (including header row)
    rows.forEach(row => {
        const cells = Array.from(row.children);
        if (cells.length <= Math.max(fromIndex, toIndex)) return;
        
        // Get the cells to swap
        const fromCell = cells[fromIndex];
        const toCell = cells[toIndex];
        
        // If moving right, insert before the target's next sibling
        if (fromIndex < toIndex) {
            if (toCell.nextElementSibling) {
                row.insertBefore(fromCell, toCell.nextElementSibling);
            } else {
                row.appendChild(fromCell);
            }
        } 
        // If moving left, insert directly before the target
        else {
            row.insertBefore(fromCell, toCell);
        }
    });
    
    // Update column indices for all headers after the swap
    const allHeaders = Array.from(table.querySelectorAll('th'));
    allHeaders.forEach((header, index) => {
        header.dataset.columnIndex = index;
    });
    
    // Maintain highlighted column after reordering
    highlightSelectedColumn(investigationState.selectedColumnIndex);
}