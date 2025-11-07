import React, { useState } from 'react';
import { Form, Input, Button, message, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAxiosConfig } from '../config/api';
import { getFullPath } from '../config/constants';
import CryptoJS from 'crypto-js';
import '../styles/LoginPage.css';

// 密码加密函数，与Java后端保持一致
const encryptPassword = (password: string): string => {
  // 第一次MD5加密并转大写
  const pwd1 = CryptoJS.MD5(password).toString().toUpperCase();
  // 第二次MD5加密（加盐）并转大写
  const salt = 'WCMX_YVR';
  return CryptoJS.MD5(pwd1 + salt).toString().toUpperCase();
};

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      // 开发环境和生产环境统一调用真实的登录接口
      // 对密码进行加密处理
      const encryptedPassword = encryptPassword(values.password);
      
      // 打印请求信息用于调试
      console.log('登录请求地址:', API.LOGIN);
      console.log('登录请求参数:', { mobile: values.username, pwd: encryptedPassword });
      console.log('请求方法: POST');
      
      // 使用统一的axios配置，确保请求头正确设置
      const axiosConfig = getAxiosConfig();
      console.log('请求配置:', axiosConfig);
      
      const response = await axios.post(API.LOGIN, {
        mobile: values.username,
        pwd: encryptedPassword
      }, getAxiosConfig());
      
      // 所有HTTP接口响应都会包含errCode和errMsg字段，业务数据在data对象中
      // 只有当errCode为0时，才表示接口业务正确
      const { errCode, errMsg, data } = response.data;
      
      if (errCode === 0) {
        // 业务逻辑成功，从data对象中获取token并保存
        const token = data?.token;
        console.log('登录接口返回的token值:', token);
        sessionStorage.setItem('token', token);
        console.log('token已保存到sessionStorage，验证保存结果:', sessionStorage.getItem('token'));
        message.success('登录成功');
        navigate(getFullPath('manage'));
      } else {
        // 业务逻辑失败，显示错误信息
        console.error('登录业务逻辑失败:', { errCode, errMsg });
        message.error(errMsg || '登录失败，请检查用户名和密码');
      }
    } catch (error) {
      // 增强错误处理，记录更详细的错误信息
      console.error('登录请求失败详情:', error);
      if (axios.isAxiosError(error)) {
        console.error('HTTP状态码:', error.response?.status);
        console.error('响应数据:', error.response?.data);
        console.error('请求配置:', error.config);
        console.error('允许的HTTP方法:', error.response?.headers?.allow);
        message.error(`登录失败: ${error.response?.status || '未知错误'}`);
      } else {
        message.error('登录失败，请检查用户名和密码');
      }
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = () => {
    message.error('请填写正确的用户名和密码');
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <h1 className="login-title">设备数据统计系统</h1>
        <Form
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          layout="vertical"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} className="login-button">
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;