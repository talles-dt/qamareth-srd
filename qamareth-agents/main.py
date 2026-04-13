import os
from fastapi import FastAPI
app = FastAPI()
@app.get("/h")
def h():
    return {"vars": {k: len(v) for k,v in os.environ.items()}}
