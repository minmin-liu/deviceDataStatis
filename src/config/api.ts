// API配置文件
// 区分开发环境和生产环境的后端接口地址
import axios from 'axios';
import { message } from 'antd';
import { getFullPath } from './constants';

// 开发环境后端API地址 - 通常是本地或开发服务器地址
const DEV_API_BASE_URL = '/api'; // 使用Vite代理转发到开发后端

// 生产环境后端API地址 - 真实的生产服务器地址
const PROD_API_BASE_URL = 'https://manager.yvrdream.com';

// 根据当前环境选择对应的API基础地址
const API_BASE_URL = (import.meta as any).env?.DEV
  ? DEV_API_BASE_URL
  : PROD_API_BASE_URL;

// 导出环境变量，便于其他组件判断当前环境
export const IS_DEV = (import.meta as any).env?.DEV;

// 直接为原始axios对象添加拦截器，确保所有axios请求都经过处理
export const setupAxiosInterceptors = () => {
  // 请求拦截器：为所有请求自动注入token
  axios.interceptors.request.use(
    (config) => {
      const token = sessionStorage.getItem('token') || '';
      // 确保headers存在
      config.headers = config.headers || {};
      // 后端要求使用自定义header字段 token
      (config.headers as any)['token'] = token;
      return config;
    },
    (error) => Promise.reject(error)
  );

  // 响应拦截器，统一处理token过期等错误
  axios.interceptors.response.use(
    (response) => {
      // 处理响应数据
      const { errCode} = response.data || {};
      
      // 特殊处理：errCode=10021表示token过期，需要清除token并跳转到登录页面
      if (errCode === 10021 || errCode === 10020) {
        console.error('Token已过期，需要重新登录');
        sessionStorage.removeItem('token');
        message.error('登录已过期，请重新登录');
        // 使用window.location.href跳转，避免在非React组件中使用useNavigate
        window.location.href = getFullPath('login');
        
        // 抛出错误，阻止后续代码执行
        throw new Error('Token已过期');
      }
      
      return response;
    },
    (error) => {
      const data = error?.response?.data || {};
      const expired = data?.errCode === 10021 || data?.errCode === 10020;
      if (expired) {
        console.error('鉴权失效，重定向至登录');
        sessionStorage.removeItem('token');
        message.error('登录已过期，请重新登录');
        window.location.href = getFullPath('login');
      }
      return Promise.reject(error);
    }
  );
};

// 默认导出拦截器设置函数
export default setupAxiosInterceptors;

export const API = {
  // 登录接口
  LOGIN: `${API_BASE_URL}/vrmcsys/account/loginAdmin`,
  // 设备活跃度统计接口
  DEVICE_ACTIVITY: `${API_BASE_URL}/vrmcsys/datacenter/getDeviceDistributiveAtv`,
  // 设备累计激活量统计接口
  DEVICE_TOTAL: `${API_BASE_URL}/vrmcsys/datacenter/getDeviceCumulativeAtv`,
  // 设备使用时长统计接口
  DEVICE_DURATION: `${API_BASE_URL}/vrmcsys/datacenter/getDeviceCumulativeDur`,
  // 设备平均使用时长统计接口
  DEVICE_DURATION_AVG: `${API_BASE_URL}/vrmcsys/datacenter/getDeviceAverageDur`,
  // 应用使用统计接口
  APP_COMPOSITE_DUR: `${API_BASE_URL}/vrmcsys/datacenter/getAppCompositeDur`
};

// 导出axios配置函数，方便统一处理请求头、错误处理等
export const getAxiosConfig = () => {
  const token = sessionStorage.getItem('token');
  return {
    headers: {
      'token': token || '', // 使用token字段而不是Authorization Bearer
      'Content-Type': 'application/json'
    }
  };
};

// 导出文件上传的配置函数，设置token和model字段，Content-Type由浏览器自动设置（包含正确的boundary）
export const getUploadConfig = (model: string) => {
  const token = sessionStorage.getItem('token');
  return {
    headers: {
      'token': token || '', // 确保在上传文件时也传入token字段
      'model': model || '', // 添加model字段到请求头中
      // 注意：不手动设置Content-Type，让浏览器自动添加正确的multipart/form-data及boundary
    }
  };
};