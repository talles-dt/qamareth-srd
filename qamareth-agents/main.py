import os
from fastapi import FastAPI
app = FastAPI()
@app.get("/h")
def h():
    keys = {k: (len(v), v[:5]) for k,v in os.environ.items() if 'KEY' in k or 'API' in k or 'NV' in k}
    return {"env": keys}
