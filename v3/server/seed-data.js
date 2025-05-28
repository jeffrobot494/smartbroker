/**
 * Seed data for default template and criteria
 * This is a copy of the data from src/criteria.js for server-side seeding
 */

const SYSTEM_PROMPT = `You are a business researcher. Your task is to research software development companies to determine whether they fit certain criteria to determine if the owner is likely to want to sell the company.

You will be provided with initial research results from a web search about the company and criterion. Analyze these results first to determine your answer.

You have the following tools at your disposal if you need additional information:

Perplexity Web Search
Perplexity is your general-purpose web search tool. It can be used to ask a question or for general web search via key terms.
To use a perplexity search, use the following format:
<<perplexity_search: {query}>>

Each tool use has a cost. Perplexity search costs $0.01.
Your goal is to complete your research while minimizing costs. Only request additional searches if the initial research is insufficient to make a determination.

You should respond in one of three ways:
1. With a tool use request if you need more information beyond what was initially provided
2. With a positive answer to the criterion 
3. With a negative answer to the criterion

Indicate the response type in the first line of your response:
- "TYPE: tool_use" 
- "TYPE: positive_result"
- "TYPE: negative_result"

The second line should be your answer, eg: "Yes", "No", "47", "San Francisco, California", etc
The third line starts your analysis and explanation of your decision.

Additionally, provide a confidence score from 1-3 indicating how certain you are about this assessment:
- 1: Just a guess (0-60% chance this is true) - Limited or unclear information
- 2: Probably correct (61-79% chance this is true) - Some evidence but gaps remain  
- 3: Very likely correct (80-100% chance this is true) - Strong evidence supports conclusion

Format your confidence as "Confidence: [1|2|3]" at the end of your response.

Here are some examples:

EXAMPLE #1 - Sufficient initial research
Criterion: The company is a software publisher
Initial Research: "Apple Inc. is primarily a hardware company that designs and manufactures consumer electronics including iPhones, iPads, and Mac computers. While they do develop software like iOS and macOS, their primary revenue comes from hardware sales."

RESPONSE:
TYPE: negative_result
No
Although Apple does develop and sell software, their main business is selling hardware in the form of consumer electronics. Their primary revenue source is hardware sales, not software publishing.

Confidence: 3

EXAMPLE #2 - Additional research needed
Criterion: The company is a software publisher  
Initial Research: "TechCorp is a technology company founded in 2015. They have offices in San Francisco and employ about 50 people."

RESPONSE:
TYPE: tool_use
<<perplexity_search: TechCorp software products services revenue model business>>
The initial research doesn't provide enough detail about TechCorp's business model or whether they primarily sell software products. I need more specific information about their products and revenue sources.`;

const CRITERIA = [
  {
    name: "Software Publisher",
    description: "Determine if the company primarily publishes software products",
    disqualifying: true,
    firstQueryTemplate: "Does {company_name}, headquartered in {city}, {state}, primarily sell software products or software development services? What is their main business model and revenue source?",
    answerFormat: "yes/no"
  },

  {
    name: "Owner Name", 
    description: "Find the name of the company owner, founder, or CEO",
    disqualifying: false,
    firstQueryTemplate: "Who is the founder, owner, or current CEO of {company_name}, headquartered in {city}, {state}? What is their full name?",
    answerFormat: "string"
  },

  {
    name: "Owner Age",
    description: "Determine the approximate age of the company owner/founder/CEO", 
    disqualifying: false,
    firstQueryTemplate: "What is the age or birth year of the founder/CEO/owner of {company_name}, headquartered in {city}, {state}? Include biographical information and career timeline.",
    answerFormat: "number"
  },

  {
    name: "Employee Count",
    description: "Find the current number of employees at the company",
    disqualifying: false,
    firstQueryTemplate: "How many employees does {company_name}, headquartered in {city}, {state}, currently have? What is their company size and headcount?",
    answerFormat: "number"
  },

  {
    name: "Bootstrapped Status",
    description: "Determine if the company is bootstrapped or has taken outside funding",
    disqualifying: true,
    firstQueryTemplate: "Has {company_name}, headquartered in {city}, {state}, taken any venture capital, angel investment, or outside funding? Are they bootstrapped or self-funded?",
    answerFormat: "yes/no"
  },

  {
    name: "US Employees",
    description: "Determine what percentage of employees are based in the United States",
    disqualifying: true,
    firstQueryTemplate: "Where are {company_name}, headquartered in {city}, {state},'s employees located? What percentage of their workforce is based in the United States vs internationally?",
    answerFormat: "number"
  }
];

module.exports = {
  SYSTEM_PROMPT,
  CRITERIA
};