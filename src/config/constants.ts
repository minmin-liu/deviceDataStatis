// 全局常量配置

// 应用路径前缀，用于路由和资源引用
export const APP_BASE_PATH = 'devicestatis';

// 生成完整的路径，自动添加前缀
export const getFullPath = (path: string): string => {
  // 确保路径不以/开头
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `/${APP_BASE_PATH}/${cleanPath}`;
};