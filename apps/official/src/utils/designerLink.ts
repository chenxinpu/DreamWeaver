/* 官方App → 独立「织梦 · 服装设计师App」跳转（dev 环境约定；正式版为各自域名/深链） */
export const DESIGNER_APP_URL = 'http://localhost:5174';

export const openDesigner = (hashPath = '') => {
  window.open(`${DESIGNER_APP_URL}/#${hashPath}`, '_blank', 'noopener');
};
