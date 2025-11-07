import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Typography, Card, Button, message, Spin, Empty, Select } from 'antd';
import { LogoutOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, getAxiosConfig } from '../config/api';
import { getFullPath } from '../config/constants';
import '../styles/DeviceStatsPage.css';

// 引入图表库
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

// 数据类型定义
interface ApiStatData {
  activeDate: string;
  activeCount: number;
}

interface ApiResponse {
  errCode: number;
  errMsg: string;
  data: {
    atvs: ApiStatData[];
  };
}

const DeviceStatsPage: React.FC = () => {
  const [activeStats, setActiveStats] = useState<ApiStatData[]>([]);
  const [totalStats, setTotalStats] = useState<ApiStatData[]>([]);
  const [activeLoading, setActiveLoading] = useState<boolean>(false);
  const [totalLoading, setTotalLoading] = useState<boolean>(false);
  // 为每个图表创建独立的筛选参数
  const [activePoint, setActivePoint] = useState<number>(0); // 活跃设备数据类型
  const [activeType, setActiveType] = useState<number>(1); // 活跃设备统计周期
  const [totalPoint, setTotalPoint] = useState<number>(0); // 累计设备数据类型
  const [totalType, setTotalType] = useState<number>(1); // 累计设备统计周期
  const navigate = useNavigate();

  // 获取设备活跃度数据
  const fetchActiveData = useCallback(async () => {
    setActiveLoading(true);
    try {
      const activeParams = {
        model: 'PFDM MR',
        point: activePoint,
        type: activeType
      };
      
      const activeResponse = await axios.post<ApiResponse>(API.DEVICE_ACTIVITY, activeParams, getAxiosConfig());

      // 处理设备活跃度数据
      if (activeResponse.data.errCode === 0 && activeResponse.data.data?.atvs) {
        setActiveStats(activeResponse.data.data.atvs);
      } else {
        message.error('获取设备活跃度数据失败');
        setActiveStats([]);
      }
    } catch (error) {
      console.error('获取设备活跃度数据失败:', error);
      message.error('获取设备活跃度数据失败，请重试');
      setActiveStats([]);
    } finally {
      setActiveLoading(false);
    }
  }, [activePoint, activeType]);

  // 获取设备累计激活量数据
  const fetchTotalData = useCallback(async () => {
    setTotalLoading(true);
    try {
      const totalParams = {
        model: 'PFDM MR',
        point: totalPoint,
        type: totalType
      };
      
      const totalResponse = await axios.post<ApiResponse>(API.DEVICE_TOTAL, totalParams, getAxiosConfig());

      // 处理设备累计激活量数据
      if (totalResponse.data.errCode === 0 && totalResponse.data.data?.atvs) {
        setTotalStats(totalResponse.data.data.atvs);
      } else {
        message.error('获取设备累计激活量数据失败');
        setTotalStats([]);
      }
    } catch (error) {
      console.error('获取设备累计激活量数据失败:', error);
      message.error('获取设备累计激活量数据失败，请重试');
      setTotalStats([]);
    } finally {
      setTotalLoading(false);
    }
  }, [totalPoint, totalType]);

  // 使用一个单独的useEffect来处理初始数据加载
  useEffect(() => {
    let isMounted = true;
    
    const fetchInitialData = async () => {
      if (!isMounted) return;
      
      // 初始加载时同时设置两个loading状态
      if (isMounted) {
        setActiveLoading(true);
        setTotalLoading(true);
      }
      
      try {
        // 并行请求两个接口
        const [activeResponse, totalResponse] = await Promise.all([
          axios.post<ApiResponse>(API.DEVICE_ACTIVITY, {
            model: 'PFDM MR',
            point: 0,
            type: 1
          }, getAxiosConfig()),
          axios.post<ApiResponse>(API.DEVICE_TOTAL, {
            model: 'PFDM MR',
            point: 0,
            type: 1
          }, getAxiosConfig())
        ]);
        
        if (!isMounted) return;
        
        // 处理响应数据
        if (activeResponse.data.errCode === 0 && activeResponse.data.data?.atvs) {
          setActiveStats(activeResponse.data.data.atvs);
        }
        
        if (totalResponse.data.errCode === 0 && totalResponse.data.data?.atvs) {
          setTotalStats(totalResponse.data.data.atvs);
        }
      } catch (error) {
        console.error('获取初始数据失败:', error);
        if (isMounted) {
          message.error('获取数据失败，请稍后重试');
        }
      } finally {
        if (isMounted) {
          setActiveLoading(false);
          setTotalLoading(false);
        }
      }
    };
    
    fetchInitialData();
    
    return () => {
      isMounted = false;
    };
  }, []); // 空依赖数组确保只执行一次
  
  // 定义ref在组件顶层，用于标记初始渲染
  const isFirstRenderActive = React.useRef(true);
  const isFirstRenderTotal = React.useRef(true);
  
  // 设备活跃度筛选条件变化时自动获取数据（排除初始加载）
  useEffect(() => {
    if (isFirstRenderActive.current) {
      // 第一次渲染时不执行，只在后续变更时执行
      isFirstRenderActive.current = false;
      return;
    }
    
    fetchActiveData();
  }, [activePoint, activeType, fetchActiveData]);
  
  // 设备累计激活筛选条件变化时自动获取数据（排除初始加载）
  useEffect(() => {
    if (isFirstRenderTotal.current) {
      // 第一次渲染时不执行，只在后续变更时执行
      isFirstRenderTotal.current = false;
      return;
    }
    
    fetchTotalData();
  }, [totalPoint, totalType, fetchTotalData]);
  
  // 手动刷新设备活跃度数据
  const handleActiveRefresh = () => {
    fetchActiveData();
  };

  // 手动刷新设备累计激活数据
  const handleTotalRefresh = () => {
    fetchTotalData();
  };

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate(getFullPath('login'));
    message.success('已退出登录');
  };

  return (
    <Layout className="stats-layout">
      <Header className="stats-header">
        <div className="header-left">
          <Title level={4} style={{ color: '#fff', margin: 0 }}>设备数据统计系统</Title>
        </div>
        <div className="header-right">
          <Button 
            type="text" 
            icon={<LogoutOutlined />} 
            onClick={handleLogout}
            style={{ color: '#fff' }}
          >
            退出登录
          </Button>
        </div>
      </Header>
      <Content className="stats-content">
        <div className="stats-cards">
          {/* 设备累计激活量统计 - 放在上面 */}
          <Card className="stats-card" title="设备累计激活量统计">
            <div className="chart-filter-controls">
              <div className="filter-item">
                <Text strong>数据类型：</Text>
                <Select 
                  defaultValue={0} 
                  style={{ width: 120, marginLeft: 10 }}
                  onChange={(value) => setTotalPoint(value)}
                >
                  <Option value={0}>全部</Option>
                  <Option value={1}>C端</Option>
                  <Option value={2}>B端</Option>
                  <Option value={3}>内部</Option>
                </Select>
              </div>
              <div className="filter-item">
                <Text strong>统计周期：</Text>
                <Select 
                  defaultValue={1} 
                  style={{ width: 120, marginLeft: 10 }}
                  onChange={(value) => setTotalType(value)}
                >
                  <Option value={1}>日</Option>
                  <Option value={2}>周</Option>
                  <Option value={3}>月</Option>
                </Select>
              </div>
              <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={handleTotalRefresh}
              loading={totalLoading}
              style={{ marginLeft: 10 }}
            >
              刷新
            </Button>
            </div>
            {totalLoading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : totalStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={totalStats}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="activeDate" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="activeCount" 
                    name="累计激活设备数" 
                    stroke="#82ca9d" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>

          {/* 设备活跃度统计 - 放在下面 */}
          <Card className="stats-card" title="设备活跃度统计">
            <div className="chart-filter-controls">
              <div className="filter-item">
                <Text strong>数据类型：</Text>
                <Select 
                  defaultValue={0} 
                  style={{ width: 120, marginLeft: 10 }}
                  onChange={(value) => setActivePoint(value)}
                >
                  <Option value={0}>全部</Option>
                  <Option value={1}>C端</Option>
                  <Option value={2}>B端</Option>
                </Select>
              </div>
              <div className="filter-item">
                <Text strong>统计周期：</Text>
                <Select 
                  defaultValue={1} 
                  style={{ width: 120, marginLeft: 10 }}
                  onChange={(value) => setActiveType(value)}
                >
                  <Option value={1}>日</Option>
                  <Option value={2}>周</Option>
                  <Option value={3}>月</Option>
                </Select>
              </div>
              <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={handleActiveRefresh}
              loading={activeLoading}
              style={{ marginLeft: 10 }}
            >
              刷新
            </Button>
            </div>
            {activeLoading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : activeStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={activeStats}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="activeDate" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="activeCount" 
                    name="活跃设备数" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default DeviceStatsPage;