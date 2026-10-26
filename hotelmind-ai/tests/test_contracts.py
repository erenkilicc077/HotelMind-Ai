import json
import shutil
import subprocess
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from threadpoolctl import threadpool_limits
from hotelmind.api import app
from hotelmind.config import FEATURE_COLUMNS, PROJECT_ROOT, TARGET
from hotelmind.data import chronological_train_val_test_split
from hotelmind.demo import generate_demo_data
from hotelmind.explanation import explain
from hotelmind.export import export_browser_model
from hotelmind.modeling import make_model
from hotelmind.schemas import BookingFeatures, EXAMPLE_BOOKING


@pytest.mark.parametrize('changes',[
    {'adults':0,'children':0,'babies':0},
    {'stays_in_week_nights':0,'stays_in_weekend_nights':0},
    {'arrival_date_month':'string'}, {'customer_type':'Transient-party'},
    {'adr':float('nan')},{'lead_time':1.5},{'adults':-1},{'reservation_status':'Canceled'},
])
def test_invalid_schema_rejects(changes):
    with pytest.raises(ValidationError):BookingFeatures(**{**EXAMPLE_BOOKING,**changes})


def test_date_groups_do_not_cross_boundaries():
    days=pd.date_range('2025-01-01',periods=100).repeat(7)
    frame=pd.DataFrame({'_arrival_date':days,'is_canceled':[i%2 for i in range(len(days))]})
    a,b,c=chronological_train_val_test_split(frame)
    assert len(a)+len(b)+len(c)==len(frame)
    assert a._arrival_date.max()<b._arrival_date.min()
    assert b._arrival_date.max()<c._arrival_date.min()
    assert not {'reservation_status','reservation_status_date','assigned_room_type',TARGET}&set(FEATURE_COLUMNS)


def test_swagger_has_valid_example_and_root_dashboard():
    with TestClient(app) as client:
        schema=client.get('/openapi.json').json()
        BookingFeatures(**schema['components']['schemas']['BookingFeatures']['example'])
        response=client.get('/')
        assert response.status_code==200
        assert 'data-runtime="api"' in response.text
        assert 'booking-form' in response.text


@pytest.mark.parametrize('name',['logistic_regression','random_forest','xgboost','neural_network'])
def test_portable_model_matches_python(name,tmp_path):
    if not shutil.which('node'):pytest.skip('Node is needed for JS/Python parity')
    csv=tmp_path/'demo.csv';generate_demo_data(csv,rows=500)
    data=pd.read_csv(csv)
    with threadpool_limits(limits=2):
        model=make_model(name).fit(data[FEATURE_COLUMNS],data[TARGET])
    model._hotelmind_name=name
    model._hotelmind_baseline=model.named_steps['preprocessor'].transform(data[FEATURE_COLUMNS]).mean(axis=0)
    exported=export_browser_model(model,tmp_path/'browser.json')
    bookings=[EXAMPLE_BOOKING,{**EXAMPLE_BOOKING,'lead_time':0,'adr':0},
        {**EXAMPLE_BOOKING,'hotel':'City Hotel','deposit_type':'Non Refund','previous_cancellations':3}]
    source="""
import {readFileSync} from 'node:fs';
import {predictBooking} from './dist/assets/engine.js';
let raw='';for await(const c of process.stdin)raw+=c;
const {model,bookings}=JSON.parse(raw);
console.log(JSON.stringify(bookings.map(b=>predictBooking(model,b))));
"""
    process=subprocess.run(['node','--input-type=module','-e',source],input=json.dumps({'model':exported,'bookings':bookings}),text=True,capture_output=True,cwd=PROJECT_ROOT,check=True)
    js=json.loads(process.stdout)
    py=model.predict_proba(pd.DataFrame(bookings)[FEATURE_COLUMNS])[:,1]
    np.testing.assert_allclose(py,[r['cancellation_probability'] for r in js],atol=1e-6,rtol=0)
    for i,b in enumerate(bookings):
        explanation=explain(model,pd.DataFrame([b])[FEATURE_COLUMNS])
        other=js[i]['explanation']
        if explanation is None:assert other is None;continue
        a={x['feature']:x['contribution'] for x in explanation['features']}
        z={x['feature']:x['contribution'] for x in other['features']}
        np.testing.assert_allclose([a[k] for k in a],[z[k] for k in a],atol=1e-5,rtol=0)
        total=other['base_value']+other['sum_contributions']
        if other['unit']=='log_odds':total=1/(1+np.exp(-total))
        assert abs(total-py[i])<1e-5
