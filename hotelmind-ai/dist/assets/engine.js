/** Exact inference on an exported fitted pipeline. No generated risk scores.
 * TreeSHAP path operations are adapted from SHAP (MIT); see THIRD_PARTY_NOTICES.md.
 */
const sigmoid = z => 1 / (1 + Math.exp(-z));

export function validateBooking(model, booking) {
  const expected = [...model.numeric_features, ...model.categorical_features];
  if (!booking || typeof booking !== 'object' || Array.isArray(booking)) throw Error('Geçerli bir rezervasyon gerekli.');
  for (const field of Object.keys(booking)) if (!expected.includes(field)) throw Error(`Bilinmeyen alan: ${field}`);
  for (const field of model.numeric_features) {
    if (typeof booking[field] !== 'number' || !Number.isFinite(booking[field]) || booking[field] < 0 || (field !== 'adr' && !Number.isInteger(booking[field])))
      throw Error(`${model.feature_labels[field]} için geçerli, negatif olmayan bir sayı girin.`);
  }
  for (const field of model.categorical_features)
    if (!model.category_options[field].includes(booking[field])) throw Error(`${model.feature_labels[field]} için geçerli bir seçenek seçin.`);
  if (booking.adults + booking.children + booking.babies < 1) throw Error('En az bir misafir gerekli.');
  if (booking.stays_in_weekend_nights + booking.stays_in_week_nights < 1) throw Error('En az bir gece gerekli.');
}

export function transform(model, booking) {
  const p = model.preprocessor;
  const out = model.numeric_features.map((f, i) => (booking[f] - p.means[i]) / p.scales[i]);
  model.categorical_features.forEach((f, i) => p.categories[i].forEach(c => out.push(booking[f] === c ? 1 : 0)));
  return out;
}

function leftBranch(tree, node, x, strict) {
  return strict ? x[tree.feature[node]] < tree.threshold[node] : x[tree.feature[node]] <= tree.threshold[node];
}

export function probability(model, booking) {
  const x = transform(model, booking), c = model.classifier;
  if (c.kind === 'logistic') return sigmoid(c.intercept + x.reduce((sum, v, i) => sum + v * c.coef[i], 0));
  if (c.kind === 'mlp') {
    let layer = x;
    c.weights.forEach((weights, index) => {
      const last = index === c.weights.length - 1;
      layer = c.biases[index].map((b, j) => {
        const v = b + layer.reduce((sum, z, i) => sum + z * weights[i][j], 0);
        return last ? sigmoid(v) : Math.max(0, v);
      });
    });
    return layer[0];
  }
  const input = x.map(Math.fround);
  let result = c.base_margin;
  for (const tree of c.trees) {
    let node = 0;
    while (tree.left[node] >= 0) node = leftBranch(tree, node, input, c.kind === 'xgboost') ? tree.left[node] : tree.right[node];
    result += tree.value[node];
  }
  return c.kind === 'xgboost' ? sigmoid(result) : result;
}

function extend(path, depth, zero, one, feature) {
  path.f[depth] = feature; path.z[depth] = zero; path.o[depth] = one; path.w[depth] = depth === 0 ? 1 : 0;
  for (let i = depth - 1; i >= 0; i--) {
    path.w[i + 1] += one * path.w[i] * (i + 1) / (depth + 1);
    path.w[i] = zero * path.w[i] * (depth - i) / (depth + 1);
  }
}

function unwind(path, depth, index) {
  const one = path.o[index], zero = path.z[index];
  let next = path.w[depth];
  for (let i = depth - 1; i >= 0; i--) {
    if (one !== 0) {
      const prior = path.w[i];
      path.w[i] = next * (depth + 1) / ((i + 1) * one);
      next = prior - path.w[i] * zero * (depth - i) / (depth + 1);
    } else path.w[i] = path.w[i] * (depth + 1) / (zero * (depth - i));
  }
  for (let i = index; i < depth; i++) {
    path.f[i] = path.f[i + 1]; path.z[i] = path.z[i + 1]; path.o[i] = path.o[i + 1];
  }
}

function unwoundSum(path, depth, index) {
  const one = path.o[index], zero = path.z[index];
  let next = path.w[depth], sum = 0;
  for (let i = depth - 1; i >= 0; i--) {
    if (one !== 0) {
      const portion = next * (depth + 1) / ((i + 1) * one);
      sum += portion;
      next = path.w[i] - portion * zero * (depth - i) / (depth + 1);
    } else sum += path.w[i] * (depth + 1) / (zero * (depth - i));
  }
  return sum;
}

function treeShap(tree, input, phi, strict) {
  function visit(node, depth, parent, zero, one, feature) {
    const path = { f: parent.f.slice(), z: parent.z.slice(), o: parent.o.slice(), w: parent.w.slice() };
    extend(path, depth, zero, one, feature);
    if (tree.left[node] < 0) {
      for (let i = 1; i <= depth; i++)
        phi[path.f[i]] += unwoundSum(path, depth, i) * (path.o[i] - path.z[i]) * tree.value[node];
      return;
    }
    const split = tree.feature[node], left = tree.left[node], right = tree.right[node];
    const hot = leftBranch(tree, node, input, strict) ? left : right, cold = hot === left ? right : left;
    const hotZero = tree.cover[hot] / tree.cover[node], coldZero = tree.cover[cold] / tree.cover[node];
    let incomingZero = 1, incomingOne = 1, index = 0;
    while (index <= depth && path.f[index] !== split) index++;
    if (index <= depth) {
      incomingZero = path.z[index]; incomingOne = path.o[index];
      unwind(path, depth, index); depth--;
    }
    visit(hot, depth + 1, path, hotZero * incomingZero, incomingOne, split);
    visit(cold, depth + 1, path, coldZero * incomingZero, 0, split);
  }
  visit(0, 0, { f: [], z: [], o: [], w: [] }, 1, 1, -1);
}

export function explainBooking(model, booking) {
  const c = model.classifier, x = transform(model, booking), phi = new Float64Array(x.length);
  let base = 0, method;
  if (c.kind === 'logistic') {
    base = c.intercept;
    x.forEach((v, i) => { phi[i] = (v - c.baseline[i]) * c.coef[i]; base += c.baseline[i] * c.coef[i]; });
    method = 'Linear SHAP · independent background';
  } else if (c.kind === 'forest' || c.kind === 'xgboost') {
    const input = x.map(Math.fround);
    base = c.base_margin;
    for (const tree of c.trees) { base += tree.value[0]; treeShap(tree, input, phi, c.kind === 'xgboost'); }
    method = 'TreeSHAP · tree_path_dependent';
  } else return null;
  const grouped = {};
  model.encoded_groups.forEach((f, i) => { grouped[f] = (grouped[f] || 0) + phi[i]; });
  return { method, unit: c.unit, base_value: base, sum_contributions: [...phi].reduce((a, b) => a + b, 0),
    features: Object.entries(grouped).map(([feature, contribution]) => ({ feature, label: model.feature_labels[feature], contribution }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)) };
}

export function predictBooking(model, booking, includeExplanation = true) {
  validateBooking(model, booking);
  const p = probability(model, booking);
  return { cancellation_probability: Math.round(p * 1e6) / 1e6, predicted_cancellation: p >= .5,
    risk_level: p < .3 ? 'Low' : p < .65 ? 'Medium' : 'High', model_version: model.model_version,
    model_name: model.model_name, explanation: includeExplanation ? explainBooking(model, booking) : null };
}
