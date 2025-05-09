from openai import OpenAI
import json

YOUR_API_KEY = "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"

messages = [
    {
        "role": "system",
        "content": (
            "You are an artificial intelligence assistant and you need to "
            "engage in a helpful, detailed, polite conversation with a user."
        ),
    },
    {   
        "role": "user",
        "content": (
            "How many stars are in the universe?"
        ),
    },
]

client = OpenAI(api_key=YOUR_API_KEY, base_url="https://api.perplexity.ai")

try:
    # chat completion without streaming
    response = client.chat.completions.create(
        model="sonar-pro",
        messages=messages,
    )
    
    # Write the response to a file
    with open("perplexity_response.txt", "w", encoding="utf-8") as f:
        f.write(str(response))
        f.write("\n\nContent: " + response.choices[0].message.content)
    
    print("Non-streaming response saved to perplexity_response.txt")
    
    # chat completion with streaming
    with open("perplexity_streaming.txt", "w", encoding="utf-8") as f:
        response_stream = client.chat.completions.create(
            model="sonar-pro",
            messages=messages,
            stream=True,
        )
        
        f.write("Streaming response:\n")
        full_content = ""
        for chunk in response_stream:
            chunk_text = str(chunk)
            f.write(chunk_text + "\n")
            if hasattr(chunk.choices[0], 'delta') and hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content:
                full_content += chunk.choices[0].delta.content
        
        f.write("\n\nFull content from streaming:\n" + full_content)
    
    print("Streaming response saved to perplexity_streaming.txt")
    
except Exception as e:
    with open("perplexity_error.txt", "w", encoding="utf-8") as f:
        f.write(f"Error: {str(e)}")
    print(f"Error occurred: {str(e)}")
    print("Error details saved to perplexity_error.txt")