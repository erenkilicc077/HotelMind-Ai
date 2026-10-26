"""Publish the exact fitted model and measured reports to the web dashboard."""
import argparse
import json
import shutil
from pathlib import Path
import joblib
from hotelmind.config import ARTIFACT_DIR, PROJECT_ROOT
from hotelmind.export import export_browser_model


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--models',type=Path,default=ARTIFACT_DIR)
    parser.add_argument('--web',type=Path,default=PROJECT_ROOT/'dist')
    args=parser.parse_args()
    target=args.web/'assets'
    model=joblib.load(args.models/'cancellation_pipeline.joblib')
    export_browser_model(model,target/'model.json')
    for name in ['metrics.json','dataset_summary.json']:
        source=args.models/name
        if source.exists():shutil.copy2(source,target/name)
    print(json.dumps({'model':model._hotelmind_name,'browser_model_bytes':(target/'model.json').stat().st_size,'output':str(target)},indent=2))

if __name__=='__main__':main()
