export function inferMode(dataConfig, requestData) {
  const hasSources = dataConfig?.sources && Object.keys(dataConfig.sources).length > 0;
  const hasData = requestData && Object.keys(requestData).length > 0;

  if (hasSources && hasData) return 'hybrid';
  if (hasSources) return 'fetch';
  return 'passthrough';
}

export function merge(fetchedData, clientData) {
  return { ...fetchedData, ...clientData };
}
