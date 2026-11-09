"""Import a small balanced, attributed Bitext travel sample. No API key required."""
import csv
import io
import json
import re
import urllib.request
from pathlib import Path

SOURCE = 'https://huggingface.co/datasets/bitext/Bitext-travel-llm-chatbot-training-dataset'
URL = SOURCE + '/resolve/main/bitext-travel-llm-chatbot-training-dataset.csv'
root = Path(__file__).resolve().parents[1]
with urllib.request.urlopen(URL, timeout=60) as response:
    raw = response.read().decode('utf-8-sig')
counts = {}
records = []
for row in csv.DictReader(io.StringIO(raw)):
    intent = row['intent']
    if counts.get(intent, 0) >= 2 or re.search(r'fuck|shit|bitch|asshole', row['instruction'], re.I):
        continue
    records.append({k: row[k] for k in ['instruction', 'intent', 'category']})
    counts[intent] = counts.get(intent, 0) + 1
target = root / 'frontend/public/data/travel-examples.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({'source':SOURCE,'author':'Bitext','license':'CDLA-Sharing-1.0','purpose':'Intent examples only; not supplier policies or booking facts.','examples':records}, indent=2), encoding='utf-8')
print(f'Imported {len(records)} examples across {len(counts)} intents. Attribution preserved.')
