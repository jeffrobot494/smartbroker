import os
import requests
import json
import time

# API Keys (should be stored more securely in production)
ANTHROPIC_API_KEY = "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"
PERPLEXITY_API_KEY = "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"

# Anthropic API endpoint
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

# Perplexity API endpoint
PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

# Criteria list for reference
CRITERIA = [
    "1. Is the company selling an actual software product, not software development services?",
    "2. Does the company have 5-50 employees based in the USA or Canada?",
    "3. Does the company sell boring, stable 'vertical market software' that's deeply embedded in an industry?",
    "4. Is the company bootstrapped (or friends and family funded) with no Venture Capital?",
    "5. Are the company owners older (50+)?"
]

def clear_screen():
    """Clear the terminal screen with better cross-platform support."""
    # For Windows
    if os.name == 'nt':
        os.system('cls')
    # For macOS and Linux
    else:
        os.system('clear')
        
    # Alternative method using ANSI escape codes as backup
    # This works in most modern terminals regardless of OS
    print("\033c\033[3J\033[H\033[2J", end="")

def print_header():
    """Print the SmartBroker header."""
    clear_screen()
    print("="*80)
    print(" "*30 + "SMARTBROKER" + " "*30)
    print("="*80)
    print()

def get_company_info():
    """Get initial company information from the user."""
    print_header()
    print("Welcome to the SmartBroker Investigation Tool!")
    print("\nPlease provide information about the company you want to investigate.")
    print("The more information you provide, the better the results will be.\n")
    
    company_name = input("Company Name: ")
    website_domain = input("Website Domain (optional): ")
    linkedin_url = input("LinkedIn URL (optional): ")
    additional_info = input("Any Additional Information (optional): ")
    
    company_info = {
        "name": company_name,
        "website": website_domain,
        "linkedin": linkedin_url,
        "additional_info": additional_info
    }
    
    return company_info

def send_anthropic_message(system_message, messages, max_tokens=4000):
    """Send a message to Anthropic's Claude API."""
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    payload = {
        "model": "claude-3-haiku-20240307",
        "system": system_message,
        "messages": messages,
        "max_tokens": max_tokens
    }
    
    try:
        response = requests.post(ANTHROPIC_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()["content"][0]["text"]
    except Exception as e:
        print(f"Error with Anthropic API: {e}")
        if hasattr(response, 'text'):
            print(f"Response: {response.text}")
        return "Error: Could not get a response from Claude."

def search_perplexity(query):
    """Search using Perplexity API and return results."""
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "sonar-pro",
        "messages": [{"role": "user", "content": query}]
    }
    
    try:
        response = requests.post(PERPLEXITY_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Error with Perplexity API: {e}")
        if hasattr(response, 'text'):
            print(f"Response: {response.text}")
        return "Error: Could not get search results."

def get_criterion_question():
    """Get the criterion to investigate."""
    print("\nWhich criterion would you like to investigate?")
    for idx, criterion in enumerate(CRITERIA, 1):
        print(f"{idx}. {criterion[3:]}")  # Remove the numbering from CRITERIA
    
    print(f"{len(CRITERIA) + 1}. Custom question")
    
    while True:
        try:
            choice = int(input("\nEnter the number of your choice: "))
            if 1 <= choice <= len(CRITERIA) + 1:
                break
            else:
                print(f"Please enter a number between 1 and {len(CRITERIA) + 1}")
        except ValueError:
            print("Please enter a valid number.")
    
    if choice <= len(CRITERIA):
        return CRITERIA[choice - 1]
    else:
        return input("Enter your custom question: ")

def investigate_company(company_info):
    """Main investigation function."""
    print_header()
    print(f"Starting investigation for: {company_info['name']}")
    print("\nInvestigation process: For each criterion, we'll search the web and analyze the results.")
    print("You can approve search queries or modify them as needed.\n")
    
    # Initialize conversation with Claude
    system_message = f"""
    You are the SmartBroker Investigation Assistant, an expert at finding information about software companies.
    
    You're helping investigate if {company_info['name']} is a good acquisition target. The criteria are:
    
    1. The company should be selling an actual software product, not software development services
    2. The company should have 5-50 employees based in the USA or Canada
    3. The company should sell boring, stable "vertical market software" that's deeply embedded in an industry
    4. The company should be bootstrapped (or friends and family funded) with no Venture Capital
    5. The owners should be older (50+)
    
    When investigating criteria, follow these guidelines:
    1. Suggest a specific, well-crafted search query to find the information
    2. Analyze the search results to extract relevant information
    3. If you find the answer, clearly state it and the confidence level
    4. If you don't find the answer, suggest a refined search query
    5. If after multiple attempts you believe the information cannot be found, state so clearly
    
    Be efficient in your search process. Don't waste searches on information that's unlikely to be found.
    """
    
    messages = [
        {"role": "assistant", "content": f"I'll help you investigate {company_info['name']} to determine if it's a good acquisition target. Let's start by gathering information about the five criteria. Which criterion would you like to investigate first?"}
    ]

    # Main investigation loop
    investigation_complete = False
    while not investigation_complete:
        # Get user input
        user_input = input("> ")
        messages.append({"role": "user", "content": user_input})
        
        # Get Claude's response
        claude_response = send_anthropic_message(system_message, messages)
        messages.append({"role": "assistant", "content": claude_response})
        print(f"\n{claude_response}\n")
        
        # If Claude is suggesting a search query
        if "search query:" in claude_response.lower() or "suggest searching for:" in claude_response.lower():
            # Extract the proposed query
            query_start = claude_response.lower().find("search query:") 
            if query_start == -1:
                query_start = claude_response.lower().find("suggest searching for:")
            
            query_start = claude_response.find(":", query_start) + 1
            query_end = claude_response.find("\n", query_start)
            if query_end == -1:
                query_end = len(claude_response)
            
            proposed_query = claude_response[query_start:query_end].strip()
            
            # Get user approval
            print(f"Proposed search query: {proposed_query}")
            modified_query = input("Press Enter to approve or type a modified query: ")
            
            if modified_query:
                search_query = modified_query
            else:
                search_query = proposed_query
            
            # Perform the search
            print("\nSearching...")
            search_results = search_perplexity(search_query)
            print("\nSearch Results:")
            print("-" * 80)
            print(search_results)
            print("-" * 80)
            
            # Wait for user acknowledgment
            input("\nPress Enter to continue...")
            
            # Add search results to the conversation
            messages.append({"role": "user", "content": f"Here are the search results for '{search_query}':\n\n{search_results}\n\nWhat did you learn about the question from these results?"})
            
            # Get Claude's analysis
            analysis = send_anthropic_message(system_message, messages)
            messages.append({"role": "assistant", "content": analysis})
            print(f"\n{analysis}\n")
            
            # Wait for user acknowledgment
            input("Press Enter to continue...")
            
        # Check if we should investigate another criterion
        if "another criterion" in claude_response.lower() or "next criterion" in claude_response.lower() or "would you like to investigate" in claude_response.lower():
            criterion = get_criterion_question()
            messages.append({"role": "user", "content": f"Let's investigate: {criterion}"})
            
            # Get Claude's response for the new criterion
            claude_response = send_anthropic_message(system_message, messages)
            messages.append({"role": "assistant", "content": claude_response})
            print(f"\n{claude_response}\n")
        
        # Check if investigation is complete
        if "investigation complete" in claude_response.lower() or "investigation is complete" in claude_response.lower():
            investigation_complete = True

def main():
    """Main function to run the SmartBroker script."""
    company_info = get_company_info()
    investigate_company(company_info)
    
    print("\nInvestigation complete. Thank you for using SmartBroker!")
    print("A full report is available for this company with all findings.")

if __name__ == "__main__":
    main()