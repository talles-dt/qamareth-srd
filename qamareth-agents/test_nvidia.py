import os
from openai import OpenAI
client = OpenAI(
 base_url="https://integrate.api.nvidia.com/v1",
 api_key=os.getenv("NVIDIA_API_KEY"),
)
response = client.chat.completions.create(
 model="meta/llama-3.3-70b-instruct",
 messages=[{"role": "user", "content": "Hello!"}],
 max_tokens=10,
)
print(response.choices[0].message.content)