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
    
    Follow these steps:
    1. Use the search_web tool to search for the company's official website
    2. Extract just the primary domain (e.g., "apple.com" not "https://www.apple.com/iphone")
    3. Verify it's the official site, not a social media page or third-party site
    4. If multiple domains exist (international versions), prefer the main/global one
    
    Return ONLY the domain as plain text (e.g., "company.com").
    If you can't find the domain with high confidence, return "Unknown".
    """
    
    user_message = f"Find the official website domain for: {company_name}"
    
    response = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1000,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )
    
    website = response.content[0].text.strip()
    return website

def get_company_owner(company_name, website):
    """Use Claude with Perplexity to find the company's owner/CEO."""
    system_prompt = """
    You have access to a Perplexity search tool through an MCP server. 
    Your task is to find the current owner, CEO, or founder of the specified company.
    
    Follow these steps:
    1. Use the search_web tool to search for the company's leadership information
    2. Look for the current CEO, owner, or main founder
    3. For private companies, focus on finding the owner
    4. For public companies, identify the CEO and/or founder
    
    Return ONLY the full name of the person as plain text (e.g., "John Smith").
    If you can't find the information with high confidence, return "Unknown".
    If the company has multiple owners/founders and one is clearly the main person, return only that name.
    """
    
    user_message = f"Who is the current owner, CEO, or main founder of {company_name}? Their website is {website}."
    
    response = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1000,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )
    
    owner = response.content[0].text.strip()
    return owner

def get_company_products(company_name, website):
    """Use Claude with Perplexity to determine what the company sells."""
    system_prompt = """
    You have access to a Perplexity search tool through an MCP server. 
    Your task is to identify what products or services the specified company sells or provides.
    
    Follow these steps:
    1. Use the search_web tool to search for information about the company's offerings
    2. Clearly distinguish between products (tangible goods) and services
    3. Be specific about the main categories of offerings
    4. Focus on their current core business, not minor offerings or historical products
    
    Return a concise description (maximum 2-3 sentences) of what the company sells or provides.
    If you can't find the information with high confidence, return "Unknown".
    """
    
    user_message = f"What products or services does {company_name} sell or provide? Their website is {website}."
    
    response = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1000,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )
    
    products = response.content[0].text.strip()
    return products

def main():
    """Main function to gather and display company information."""
    args = parse_arguments()
    company_name = args.company_name
    
    print(f"\nResearching information for: {company_name}\n")
    print("This may take a minute as Claude uses Perplexity to search for information...\n")
    
    # Get company website
    print("Finding company website...")
    website = get_company_website(company_name)
    
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
        "products_services": products
    }
    
    # Display results
    print("\n" + "="*50)
    print(f"COMPANY INFORMATION: {company_name}")
    print("="*50)
    print(f"Website: {website}")
    print(f"Owner/CEO: {owner}")
    print(f"Products/Services: {products}")
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