export const proberHttp = async (target, keyword = null) => {
  try {
    const startTime = performance.now();
    const response = await fetch(target, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'PulseGrid-Uptime-Bot/1.0' },
    });

    if (response.status < 200 || response.status >= 400) {
      throw new Error(`Unexpected HTTP status: ${response.status}`);
    }

    if (keyword) {
      const body = await response.text();
      if (!body.includes(keyword)) {
        throw new Error('Keyword assertion failed');
      }
    }

    return {
      status: 'up',
      latency: Math.round(performance.now() - startTime),
      error: null,
    };
  } catch (err) {
    return {
      status: 'down',
      latency: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};
