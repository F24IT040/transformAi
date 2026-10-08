const { preprocessSource } = require('../backend/src/services/sourcePreprocessor');

const raw = [
  'Executive Brief: Cyber Attack Incident Report - Indian Government ICT Infrastructure Page 1',
  'Situation',
  'This report does not claim',
  'access to confidential incident records.',
  'Key Findings',
  'This report does not claim',
  'access to confidential incident records.',
  '-- 1 of 10 --',
  'Cyber Attack Incident Report - Indian Government ICT Infrastructure Page 2',
  '1.',
  'Executive Summary',
  'In October 2023, the Indian Computer Emergency Response Team (CERT-In) issued a Critical-severity',
  'advisory concerning cyber-attack campaigns targeting Indian ICT infrastructure.',
  'Operational Impact',
  'Primary findings directly supported by extracted source intelligence.',
  'Factual claims verified across operational scope.',
  'Recommendations',
  'It covers the',
  'threat background, attack mechanism, attack lifecycle, affected security properties, detection, response,',
  'mitigation, lessons learned and a recommended resilient architecture.',
  'These systems improve accessibility and efficiency,',
  'but internet exposure also creates an attack surface that must be continuously monitored and defended.',
  'It provides threat intelligence and',
  'recommended defensive actions, while organization-specific logs, affected assets and recovery metrics may remain',
  'confidential.',
  'Current Status',
  'Analyzed, verified against source evidence, and approved for operator review.',
].join('\n');

const { cleanText, stats } = preprocessSource(raw);
console.log('=== PREPROCESS STATS ===');
console.log(JSON.stringify(stats, null, 2));
console.log('');
console.log('=== CLEANED TEXT ===');
console.log(cleanText);

