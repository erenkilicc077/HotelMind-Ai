import { predictBooking } from './engine.js';
let modelPromise;
function getModel() {
  return modelPromise ||= fetch('./model.json').then(r => { if (!r.ok) throw Error('Model dosyası yüklenemedi.'); return r.json(); });
}
self.onmessage = async ({ data }) => {
  try {
    const model = await getModel();
    if (data.kind === 'init') {
      self.postMessage({ id: data.id, result: { model_name: model.model_name } });
    } else if (data.kind === 'batch') {
      self.postMessage({ id: data.id, result: data.bookings.map(b => predictBooking(model, b, false)) });
    } else {
      self.postMessage({ id: data.id, result: predictBooking(model, data.booking) });
    }
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
