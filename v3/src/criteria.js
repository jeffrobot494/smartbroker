/**
 * Research criteria definitions for SmartBroker v3
 * Based on the system prompts and pseudocode from the existing codebase
 */

const SYSTEM_PROMPT = `You are a business researcher. Your task is to research software development companies to determine whether they fit certain criteria to determine if the owner is likely to want to sell the company.

You have the following tools at your disposal:

Perplexity Web Search
Perplexity is your general-purpose web search tool. It can be used to ask a question or for general web search via key terms.
To use a perplexity search, use the following format:
<<perplexity_search: {query}>>

Each tool use has a cost. Perplexity search costs $0.01.
Your goal is to complete your research while minimizing costs. You should use perplexity searches strategically to gather the most relevant information.

You should respond in one of three ways:
1. With a tool use request if you need more information
2. With a positive answer to the criterion 
3. With a negative answer to the criterion

Indicate the response type in the first line of your response:
- "TYPE: tool_use" 
- "TYPE: positive_result"
- "TYPE: negative_result"

The second line should be your answer, eg: "Yes", "No", "47", "San Francisco, California", etc
The third line starts your analysis and explanation of your decision.

Here are some examples:

EXAMPLE #1
Criterion: The company is a software publisher

RESPONSE:
TYPE: tool_use
<<perplexity_search: does apple inc primarily publish software products for sale?>>
I need to figure out if Apple publishes software. I'll do a perplexity search.

EXAMPLE #2  
Criterion: The company is a software publisher
TYPE: negative_result
No
Although Apple does publish and sell software, their main business is selling hardware in the form of the iPhone and MacBook and iMac computers.`;

const CRITERIA = [
  {
    name: "Software Publisher",
    description: "Determine if the company primarily publishes software products",
    disqualifying: true,
    text: `Your task is to determine whether the company publishes software. You will primarily learn this from the company's website and business model.

A software publisher is a company whose primary business is developing and selling software products to customers. This includes:
- SaaS (Software as a Service) companies
- Companies that sell software licenses
- Mobile app developers who sell apps
- Enterprise software companies

This does NOT include:
- Hardware companies that happen to make software
- Consulting companies that build custom software
- IT service providers
- Companies whose software is just internal tools`,
    answerFormat: "yes/no"
  },

  {
    name: "Owner Name", 
    description: "Find the name of the company owner, founder, or CEO",
    disqualifying: false,
    text: `Your task is to find the name of the company's owner, founder, or current CEO.

Look for:
- Founder information on the company website
- Leadership team or "About Us" pages
- Press releases mentioning executives
- LinkedIn company page leadership
- News articles about the company

Provide the full name of the primary owner/founder/CEO. If there are multiple co-founders, provide the one who appears to be the primary leader or current CEO.`,
    answerFormat: "string"
  },

  {
    name: "Owner Age",
    description: "Determine the approximate age of the company owner/founder/CEO", 
    disqualifying: false,
    text: `Your task is to determine the approximate age of the company's owner, founder, or CEO.

Look for:
- Biographical information about the founder/CEO
- Educational background (graduation years can indicate age)
- Work history and career timeline
- News articles or press releases mentioning age
- LinkedIn profiles showing career progression

Provide the approximate age as a number. If you can only find age ranges, provide the middle of the range (e.g., if "40s" then answer "45").`,
    answerFormat: "number"
  },

  {
    name: "Employee Count",
    description: "Find the current number of employees at the company",
    disqualifying: false,
    text: `Your task is to find the current number of employees at the company.

Look for:
- Company website "About" or "Team" pages
- LinkedIn company page employee count
- Recent job postings indicating company size
- Press releases mentioning headcount
- Industry reports or company profiles

Provide the number of employees as a whole number. If you find a range, provide the midpoint. If you can only find rough estimates like "10-50 employees", provide the midpoint (30).`,
    answerFormat: "number"
  },

  {
    name: "Bootstrapped Status",
    description: "Determine if the company is bootstrapped or has taken outside funding",
    disqualifying: true,
    text: `Your task is to determine whether the company is bootstrapped (self-funded) or has taken outside investment.

Look for:
- Press releases about funding rounds
- Mentions of investors or venture capital
- Company statements about being self-funded
- News articles about investment
- Crunchbase or similar database entries

Answer "Yes" if the company is bootstrapped (no outside investment).
Answer "No" if the company has taken venture capital, angel investment, or other outside funding.`,
    answerFormat: "yes/no"
  },

  {
    name: "US Employees",
    description: "Determine what percentage of employees are based in the United States",
    disqualifying: true,
    text: `Your task is to determine what percentage of the company's employees are based in the United States.

Look for:
- Company office locations
- Job postings by location
- Team pages showing employee locations
- Company statements about remote/distributed workforce
- LinkedIn employee location data

Provide the percentage as a whole number (e.g., "75" for 75% US-based employees). If the company appears to be entirely US-based, answer "100". If entirely international, answer "0".`,
    answerFormat: "number"
  }
];

module.exports = {
  SYSTEM_PROMPT,
  CRITERIA
};