#!/usr/bin/env python3
"""
Company Information Gatherer

This script uses Claude with the Perplexity MCP server to gather information about a company:
- Company website/domain
- Owner/CEO name
- Products/services offered

Usage:
  python company_info.py "Company Name"
"""

import sys
import json
import argparse
import os
import anthropic
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get API key from environment variables
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY not found in environment variables.")
    print("Please create a .env file with your API key or set it in your environment.")
    sys.exit(1)

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Gather information about a company using Claude and Perplexity.")
    parser.add_argument("company_name", help="Name of the company to research")
    parser.add_argument("--output", "-o", help="Output file (JSON format)", default=None)
    parser.add_argument("--verbose", "-v", action="store_true", help="Display verbose output")
    return parser.parse_args()

def get_company_website(company_name):
    """Use Claude with Perplexity to find the company's website."""
    system_prompt = """
    You have access to a Perplexity search tool through an MCP server. 
    Your task is to find the official website/domain for the company specified.
    
    CRITICAL: You must provide your search results AND your analysis separately to help with debugging.
    
    Follow these steps:
    1. First, make a call to search_web with the company name and "official website" in your search query
    2. Begin your response with "RAW_SEARCH_RESULTS:" followed by the exact response you received from Perplexity
    3. Then include a section titled "CLAUDE_ANALYSIS:" where you detail your evaluation process:
       - List all company names mentioned in the search results
       - Indicate whether any of these EXACTLY match the provided company name (case-insensitive)
       - Explain your reasoning in detail
    4. Finally, after your analysis, include a blank line followed by your final determination:
       - If the search found the EXACT company, return the primary domain (e.g., "company.com")
       - If the search found a DIFFERENT company with a similar name, return "NOT_EXACT_MATCH"
       - If you can't find a website with confidence, return "Unknown"
    
    IMPORTANT: We need to see the full raw search results to understand how you're making your determination.
    """
    
    user_message = f"Find the official website domain for: {company_name}"
    
    # We'll try up to 3 times to get an exact match
    max_attempts = 3
    for attempt in range(max_attempts):
        if attempt > 0:
            print(f"Attempt {attempt+1}: Retrying to find exact match for '{company_name}'...")
            
        clarification = ""
        if attempt == 1:
            clarification = f" Please search specifically for the EXACT company name '{company_name}' and verify it matches exactly."
        elif attempt == 2:
            clarification = f" This is your last attempt. It's critical to find information ONLY for the EXACT company '{company_name}', not any similar companies."
            
        full_message = user_message + clarification
            
        response = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=2000,  # Increased to handle larger responses
            system=system_prompt,
            messages=[
                {"role": "user", "content": full_message}
            ]
        )
        
        full_response = response.content[0].text.strip()
        
        # Print formatted search results and analysis
        print("\n" + "="*70)
        print(f"SEARCH ATTEMPT {attempt+1}: WEBSITE FOR '{company_name}'")
        print("="*70 + "\n")
        
        # Extract and display raw search results and Claude's analysis
        raw_results = ""
        claude_analysis = ""
        final_answer = ""
        
        if "RAW_SEARCH_RESULTS:" in full_response and "CLAUDE_ANALYSIS:" in full_response:
            # Get raw search results
            parts = full_response.split("CLAUDE_ANALYSIS:", 1)
            raw_part = parts[0].replace("RAW_SEARCH_RESULTS:", "", 1).strip()
            raw_results = raw_part
            
            # Get Claude's analysis and final answer
            if "\n\n" in parts[1]:
                analysis_parts = parts[1].split("\n\n", 1)
                claude_analysis = analysis_parts[0].strip()
                if len(analysis_parts) > 1:
                    final_answer = analysis_parts[1].strip()
                else:
                    final_answer = "Unknown"
            else:
                claude_analysis = parts[1].strip()
                final_answer = "Unknown"
        else:
            # Fallback if format isn't as expected
            print("Response format not as expected. Showing full response:")
            print(full_response)
            final_answer = full_response.strip()
            
        # Display the parsed sections
        print("RAW PERPLEXITY SEARCH RESULTS:")
        print("-"*50)
        print(raw_results)
        print("\nCLAUDE'S ANALYSIS:")
        print("-"*50)
        print(claude_analysis)
        print("\nFINAL DETERMINATION:")
        print("-"*50)
        print(final_answer)
        print("\n" + "="*70 + "\n")
        
        website = final_answer.strip()
        
        if website != "NOT_EXACT_MATCH":
            return website
            
    # If we've tried multiple times and still don't have an exact match
    print(f"Warning: Could not find exact match for '{company_name}' after {max_attempts} attempts.")
    return "Unknown"

def get_company_owner(company_name, website):
    """Use Claude with Perplexity to find the company's owner/CEO."""
    system_prompt = """
    You have access to a Perplexity search tool through an MCP server. 
    Your task is to find the current owner, CEO, or founder of the specified company.
    
    CRITICAL: You must provide your search results AND your analysis separately to help with debugging.
    
    Follow these steps:
    1. First, make a call to search_web with the company name and "CEO owner founder leadership" in your search query
    2. Begin your response with "RAW_SEARCH_RESULTS:" followed by the exact response you received from Perplexity
    3. Then include a section titled "CLAUDE_ANALYSIS:" where you detail your evaluation process:
       - List all company names mentioned in the search results
       - Indicate whether any of these EXACTLY match the provided company name (case-insensitive)
       - List all potential leadership/ownership information found
       - Explain your reasoning in detail
    4. Finally, after your analysis, include a blank line followed by your final determination:
       - If the search found leadership info for the EXACT company, return only the person's name (e.g., "John Smith")
       - If the search found a DIFFERENT company with a similar name, return "NOT_EXACT_MATCH"
       - If you can't find leadership info with confidence, return "Unknown"
    
    IMPORTANT: We need to see the full raw search results to understand how you're making your determination.
    """
    
    user_message = f"Who is the current owner, CEO, or main founder of {company_name}? Their website is {website}."
    
    # We'll try up to 3 times to get an exact match
    max_attempts = 3
    for attempt in range(max_attempts):
        if attempt > 0:
            print(f"Attempt {attempt+1}: Retrying to find exact match for owner of '{company_name}'...")
            
        clarification = ""
        if attempt == 1:
            clarification = f" Please search specifically for the EXACT company '{company_name}' and verify it matches exactly."
        elif attempt == 2:
            clarification = f" This is your last attempt. It's critical to find information ONLY for the EXACT company '{company_name}', not any similar companies."
            
        full_message = user_message + clarification
            
        response = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=2000,  # Increased to handle larger responses
            system=system_prompt,
            messages=[
                {"role": "user", "content": full_message}
            ]
        )
        
        full_response = response.content[0].text.strip()
        
        # Print formatted search results and analysis
        print("\n" + "="*70)
        print(f"SEARCH ATTEMPT {attempt+1}: OWNER/CEO FOR '{company_name}'")
        print("="*70 + "\n")
        
        # Extract and display raw search results and Claude's analysis
        raw_results = ""
        claude_analysis = ""
        final_answer = ""
        
        if "RAW_SEARCH_RESULTS:" in full_response and "CLAUDE_ANALYSIS:" in full_response:
            # Get raw search results
            parts = full_response.split("CLAUDE_ANALYSIS:", 1)
            raw_part = parts[0].replace("RAW_SEARCH_RESULTS:", "", 1).strip()
            raw_results = raw_part
            
            # Get Claude's analysis and final answer
            if "\n\n" in parts[1]:
                analysis_parts = parts[1].split("\n\n", 1)
                claude_analysis = analysis_parts[0].strip()
                if len(analysis_parts) > 1:
                    final_answer = analysis_parts[1].strip()
                else:
                    final_answer = "Unknown"
            else:
                claude_analysis = parts[1].strip()
                final_answer = "Unknown"
        else:
            # Fallback if format isn't as expected
            print("Response format not as expected. Showing full response:")
            print(full_response)
            final_answer = full_response.strip()
            
        # Display the parsed sections
        print("RAW PERPLEXITY SEARCH RESULTS:")
        print("-"*50)
        print(raw_results)
        print("\nCLAUDE'S ANALYSIS:")
        print("-"*50)
        print(claude_analysis)
        print("\nFINAL DETERMINATION:")
        print("-"*50)
        print(final_answer)
        print("\n" + "="*70 + "\n")
        
        owner = final_answer.strip()
        
        if owner != "NOT_EXACT_MATCH":
            return owner
            
    # If we've tried multiple times and still don't have an exact match
    print(f"Warning: Could not find exact match for owner of '{company_name}' after {max_attempts} attempts.")
    return "Unknown"

def get_company_products(company_name, website):
    """Use Claude with Perplexity to determine what the company sells."""
    system_prompt = """
    You have access to a Perplexity search tool through an MCP server. 
    Your task is to identify what products or services the specified company sells or provides.
    
    CRITICAL: You must provide your search results AND your analysis separately to help with debugging.
    
    Follow these steps:
    1. First, make a call to search_web with the company name and "products services offerings what they sell" in your search query
    2. Begin your response with "RAW_SEARCH_RESULTS:" followed by the exact response you received from Perplexity
    3. Then include a section titled "CLAUDE_ANALYSIS:" where you detail your evaluation process:
       - List all company names mentioned in the search results
       - Indicate whether any of these EXACTLY match the provided company name (case-insensitive)
       - Identify all potential products/services mentioned
       - Explain your reasoning in detail
    4. Finally, after your analysis, include a blank line followed by your final determination:
       - If the search found info for the EXACT company, provide a concise 2-3 sentence description of their products/services
       - If the search found a DIFFERENT company with a similar name, return "NOT_EXACT_MATCH"
       - If you can't find product/service info with confidence, return "Unknown"
    
    IMPORTANT: We need to see the full raw search results to understand how you're making your determination.
    """
    
    user_message = f"What products or services does {company_name} sell or provide? Their website is {website}."
    
    # We'll try up to 3 times to get an exact match
    max_attempts = 3
    for attempt in range(max_attempts):
        if attempt > 0:
            print(f"Attempt {attempt+1}: Retrying to find exact match for products of '{company_name}'...")
            
        clarification = ""
        if attempt == 1:
            clarification = f" Please search specifically for the EXACT company '{company_name}' and verify it matches exactly."
        elif attempt == 2:
            clarification = f" This is your last attempt. It's critical to find information ONLY for the EXACT company '{company_name}', not any similar companies."
            
        full_message = user_message + clarification
            
        response = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=2000,  # Increased to handle larger responses
            system=system_prompt,
            messages=[
                {"role": "user", "content": full_message}
            ]
        )
        
        full_response = response.content[0].text.strip()
        
        # Print formatted search results and analysis
        print("\n" + "="*70)
        print(f"SEARCH ATTEMPT {attempt+1}: PRODUCTS/SERVICES FOR '{company_name}'")
        print("="*70 + "\n")
        
        # Extract and display raw search results and Claude's analysis
        raw_results = ""
        claude_analysis = ""
        final_answer = ""
        
        if "RAW_SEARCH_RESULTS:" in full_response and "CLAUDE_ANALYSIS:" in full_response:
            # Get raw search results
            parts = full_response.split("CLAUDE_ANALYSIS:", 1)
            raw_part = parts[0].replace("RAW_SEARCH_RESULTS:", "", 1).strip()
            raw_results = raw_part
            
            # Get Claude's analysis and final answer
            if "\n\n" in parts[1]:
                analysis_parts = parts[1].split("\n\n", 1)
                claude_analysis = analysis_parts[0].strip()
                if len(analysis_parts) > 1:
                    final_answer = analysis_parts[1].strip()
                else:
                    final_answer = "Unknown"
            else:
                claude_analysis = parts[1].strip()
                final_answer = "Unknown"
        else:
            # Fallback if format isn't as expected
            print("Response format not as expected. Showing full response:")
            print(full_response)
            final_answer = full_response.strip()
            
        # Display the parsed sections
        print("RAW PERPLEXITY SEARCH RESULTS:")
        print("-"*50)
        print(raw_results)
        print("\nCLAUDE'S ANALYSIS:")
        print("-"*50)
        print(claude_analysis)
        print("\nFINAL DETERMINATION:")
        print("-"*50)
        print(final_answer)
        print("\n" + "="*70 + "\n")
        
        products = final_answer.strip()
        
        if products != "NOT_EXACT_MATCH":
            return products
            
    # If we've tried multiple times and still don't have an exact match
    print(f"Warning: Could not find exact match for products of '{company_name}' after {max_attempts} attempts.")
    return "Unknown"

def main():
    """Main function to gather and display company information."""
    args = parse_arguments()
    company_name = args.company_name
    
    print(f"\nResearching information for: {company_name}\n")
    print("This may take a minute as Claude uses Perplexity to search for information...\n")
    
    # Get company website
    print("Finding company website...")
    website = get_company_website(company_name)
    
    # Only proceed with additional searches if we found a website
    if website == "Unknown":
        print(f"\n⚠️ Could not find exact match for company: {company_name}")
        print("Please verify the company name or try a more specific search.\n")
        
        # Prepare minimal results
        results = {
            "company_name": company_name,
            "website": "Unknown",
            "owner": "Unknown",
            "products_services": "Unknown",
            "exact_match": False
        }
    else:
        # Get company owner
        print("Identifying company leadership...")
        owner = get_company_owner(company_name, website)
        
        # Get company products/services
        print("Determining company offerings...")
        products = get_company_products(company_name, website)
        
        # Prepare results
        results = {
            "company_name": company_name,
            "website": website,
            "owner": owner,
            "products_services": products,
            "exact_match": True
        }
    
    # Display results
    print("\n" + "="*50)
    print(f"COMPANY INFORMATION: {company_name}")
    print("="*50)
    
    if results["exact_match"]:
        print(f"Website: {website}")
        print(f"Owner/CEO: {owner}")
        print(f"Products/Services: {products}")
    else:
        print("❌ No exact match found for this company name.")
        print("Please verify the company name and try again.")
    
    print("="*50 + "\n")
    
    # Save to file if requested
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
        print(f"Results saved to {args.output}")
        
    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Error: Company name required.")
        print("Usage: python company_info.py \"Company Name\"")
        sys.exit(1)
    
    main()