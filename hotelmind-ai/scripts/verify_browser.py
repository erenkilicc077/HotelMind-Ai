"""Compare the exported JS model + TreeSHAP against Python on real examples."""
import argparse
import json
import subprocess
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from hotelmind.config import FEATURE_COLUMNS, MODEL_PATH, PROJECT_ROOT
from hotelmind.data import load_training_data
from hotelmind.explanation import explain
from hotelmind.schemas import EXAMPLE_BOOKING


def main():
    p=argparse.ArgumentParser();p.add_argument('--data',default='data/raw/hotel_bookings.csv');args=p.parse_args()
    model=joblib.load(MODEL_PATH)
    data=load_training_data(args.data)[FEATURE_COLUMNS].dropna().sample(30,random_state=17)
    bookings=[EXAMPLE_BOOKING]+json.loads(data.to_json(orient='records'))
    for b in bookings:
        for f in FEATURE_COLUMNS:
            if f not in ['adr'] and isinstance(b[f],(float,int)):b[f]=int(b[f])
    source='''
import {readFileSync} from 'node:fs';
import {predictBooking} from './dist/assets/engine.js';
const model=JSON.parse(readFileSync('dist/assets/model.json','utf8'));
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const rows=JSON.parse(raw);
console.log(JSON.stringify(rows.map((r,i)=>predictBooking(model,r,i<6))));
'''
    completed=subprocess.run(['node','--input-type=module','-e',source],input=json.dumps(bookings),text=True,capture_output=True,cwd=PROJECT_ROOT,check=True)
    browser=json.loads(completed.stdout)
    py=model.predict_proba(pd.DataFrame(bookings)[FEATURE_COLUMNS])[:,1]
    errors=np.abs(py-np.array([r['cancellation_probability'] for r in browser]))
    max_shap_error=0.
    for i in range(6):
        actual=explain(model,pd.DataFrame([bookings[i]])[FEATURE_COLUMNS]); expected=browser[i]['explanation']
        a={r['feature']:r['contribution'] for r in actual['features']};b={r['feature']:r['contribution'] for r in expected['features']}
        max_shap_error=max(max_shap_error,max(abs(a[k]-b[k]) for k in a))
        assert abs(actual['base_value']-expected['base_value'])<1e-6
        assert abs(expected['base_value']+expected['sum_contributions']-py[i])<1e-6
    assert errors.max()<1e-6,errors.max()
    assert max_shap_error<1e-6,max_shap_error
    result={'probability_cases':len(bookings),'shap_cases':6,'max_probability_error':float(errors.max()),'max_shap_error':max_shap_error,'status':'passed'}
    (PROJECT_ROOT/'models'/'browser_parity.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
