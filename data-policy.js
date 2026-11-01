'use strict';
const collections = ['tasks', 'points', 'cues', 'sessions', 'evidence', 'journals', 'dailyReviews'];
function validateImport(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || value.schema_version !== 1)
    throw new Error('不支持的数据格式或版本');
  for (const key of collections) {
    if (!Array.isArray(value[key]) || value[key].some(item => !item || Array.isArray(item) || typeof item !== 'object'))
      throw new Error('数据集合无效：' + key);
  }
  if (!value.settings || Array.isArray(value.settings) || typeof value.settings !== 'object') throw new Error('设置格式无效');
  return value;
}
function portableData(value) {
  const copy = JSON.parse(JSON.stringify(value));
  if (copy.settings) delete copy.settings.apiKey;
  return copy;
}
function importedData(value, current) {
  const copy = portableData(validateImport(value));
  copy.settings.apiKey = current.settings.apiKey || '';
  return copy;
}
module.exports = { validateImport, portableData, importedData };
