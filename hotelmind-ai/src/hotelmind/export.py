"""Portable inference artifact: fitted preprocessing and model, never a heuristic."""
import json
from pathlib import Path
import numpy as np
from .config import CATEGORICAL_FEATURES, NUMERIC_FEATURES, FEATURE_LABELS, CATEGORY_OPTIONS, MODEL_VERSION
from .explanation import encoded_groups


def export_browser_model(pipeline, output):
    pre = pipeline.named_steps['preprocessor']
    num, cat = pre.named_transformers_['numeric'], pre.named_transformers_['categorical']
    clf = pipeline.named_steps['classifier']
    exported = {
        'format_version': 1, 'model_version': MODEL_VERSION,
        'model_name': pipeline._hotelmind_name,
        'numeric_features': NUMERIC_FEATURES, 'categorical_features': CATEGORICAL_FEATURES,
        'feature_labels': FEATURE_LABELS, 'category_options': CATEGORY_OPTIONS,
        'encoded_groups': encoded_groups(pipeline),
        'preprocessor': {'medians': num.named_steps['imputer'].statistics_.tolist(),
            'means': num.named_steps['scaler'].mean_.tolist(), 'scales': num.named_steps['scaler'].scale_.tolist(),
            'categories': [c.tolist() for c in cat.named_steps['onehot'].categories_],
            'most_frequent': cat.named_steps['imputer'].statistics_.tolist()},
    }
    name = type(clf).__name__
    if name == 'RandomForestClassifier':
        trees=[]
        for estimator in clf.estimators_:
            t=estimator.tree_
            # SHAP uses expectations consistent with child covers at every node.
            values=(t.value[:,0,1]/t.value[:,0,:].sum(axis=1)).copy()/len(clf.estimators_)
            def expected(i):
                left,right=int(t.children_left[i]),int(t.children_right[i])
                if left >= 0:
                    a,b=expected(left),expected(right)
                    values[i]=(a*t.weighted_n_node_samples[left]+b*t.weighted_n_node_samples[right])/(t.weighted_n_node_samples[left]+t.weighted_n_node_samples[right])
                return float(values[i])
            expected(0)
            trees.append({'left':t.children_left.tolist(),'right':t.children_right.tolist(),
                'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),
                'value':values.tolist(),'cover':t.weighted_n_node_samples.tolist()})
        exported['classifier']={'kind':'forest','trees':trees,'base_margin':0,'unit':'probability'}
    elif name == 'XGBClassifier':
        booster=clf.get_booster()
        cfg=json.loads(booster.save_config())
        score=cfg['learner']['learner_model_param']['base_score']
        base=float(str(score).strip('[]'))
        trees=[]
        for dump in booster.get_dump(dump_format='json',with_stats=True):
            root=json.loads(dump)
            nodes={}
            def visit(n):
                nodes[n['nodeid']]=n
                for child in n.get('children',[]):visit(child)
            visit(root)
            size=max(nodes)+1
            tree={key:[0]*size for key in ['left','right','feature','threshold','value','cover']}
            for i,n in nodes.items():
                tree['cover'][i]=n['cover']
                if 'leaf' in n:
                    tree['left'][i]=tree['right'][i]=-1
                    tree['feature'][i]=-2
                    tree['value'][i]=n['leaf']
                else:
                    tree['left'][i]=n['yes']; tree['right'][i]=n['no']
                    tree['feature'][i]=int(n['split'].lstrip('f'))
                    tree['threshold'][i]=n['split_condition']
            def expected(i):
                a,b=tree['left'][i],tree['right'][i]
                if a>=0:
                    tree['value'][i]=(expected(a)*tree['cover'][a]+expected(b)*tree['cover'][b])/(tree['cover'][a]+tree['cover'][b])
                return tree['value'][i]
            expected(0); trees.append(tree)
        exported['classifier']={'kind':'xgboost','base_margin':float(np.log(base/(1-base))),'trees':trees,'unit':'log_odds'}
    elif name == 'LogisticRegression':
        exported['classifier']={'kind':'logistic','coef':clf.coef_[0].tolist(),
            'intercept':float(clf.intercept_[0]),'baseline':pipeline._hotelmind_baseline.tolist(),'unit':'log_odds'}
    elif name == 'MLPClassifier':
        exported['classifier']={'kind':'mlp','weights':[x.tolist() for x in clf.coefs_],
            'biases':[x.tolist() for x in clf.intercepts_],'unit':'probability'}
    else:
        raise ValueError(f'Unsupported browser model: {name}')
    output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(exported,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
    return exported
