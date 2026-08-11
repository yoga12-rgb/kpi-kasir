if (typeof performance !== 'undefined') {
  performance.mark('kpi-app-init');
}

export function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse'
) {
  try {
    const path = new URL(url, window.location.origin).pathname;
    performance.mark('kpi-route-transition-start', {
      detail: { navigationType, path },
    });
  } catch {
    performance.mark('kpi-route-transition-start');
  }
}
