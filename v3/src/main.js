console.log("Hello world!");

`
print("SmartBroker v0.7")
companies = getCompaniesFromJSON(companiesRange, "company_info.json")
companiesRangeTuple = getRangeFromUI()
autoResearch = getAutoResearchFromUI()
startCriterion = getCriterionFromUI()
companiesIterator = companiesRangeTuple[0]
criterionIterator = startCriterion
input("press start to begin")
loadSystemPrompt()
sendSystemPrompt()
context = {}



while(true):
	for criterionIterator in criteria:
		for companiesIterator in companies:
			investigate(companies[companiesIterator], criterion[criterionIterator])
			companiesIterator++
		criterionIterator++


def investigate(company, criterion):
	finished = False
	prompt = ""
	companyInformation = getEverythingWeKnowAboutThisCompany(company)
	companyInformation = companyInformation.toParagraph()
	perplexity_results = perplexitySearch(criterion["first search"])
	prompt += systemPrompt
	prompt += criterion["text"]
	prompt += companyInformation
	prompt += perplexity_results
	while(not finished):
		claude_response = parseResponse(sendToClaude(prompt))
		switch(claude_response["type"]):
			"perplexity":
				prompt += perplexity_search(claude_response["text"])
			"firecrawl_text":
				prompt += firecrawl_text(claude_response["text"])
			"firecrawl_links":
				prompt += firecrawl_links(claude_response["text"])
			"phantombuster":
				prompt += phantombuster(claude_response["text"])
			"disqualified":
				//remove company from companies
				company.disqualified = claude_response["text"]
				finished = True
			"qualified":
				//add the true fact we learned to the company object
				company.facts += claude_response["text"]
				//store the fact that we passed this criterion as a bool
				company[criterion] = True
				//end the investigation
				finished = True


def parseResponse(response):
	text = response[0]["content"]
	return {"type":text.firstLine, "text":text.remaining}
`