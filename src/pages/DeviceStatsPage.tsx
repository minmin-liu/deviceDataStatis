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

interface DeviceAtvResponse {
  errCode: number;
  errMsg: string;
  data: {
    atvs: ApiStatData[];
  };
}

interface DeviceDurationStat {
  useDate: string;
  useDuration: number;
}

interface DeviceDurationResponse {
  errCode: number;
  errMsg: string;
  data: {
    durs: DeviceDurationStat[];
  };
}

const DEVICE_MODEL_OPTIONS = ['PFDM MR', 'YVR 2', 'YVR 1'];

type DurationMode = 'cumulative' | 'average';
type ActiveMode = 'activity' | 'rate';

interface ActiveRateData {
  activeDate: string;
  activeRate: number;
}

const DeviceStatsPage: React.FC = () => {
  const [activeStats, setActiveStats] = useState<ApiStatData[]>([]);
  const [activeRateStats, setActiveRateStats] = useState<ActiveRateData[]>([]);
  const [totalStats, setTotalStats] = useState<ApiStatData[]>([]);
  const [durationStats, setDurationStats] = useState<DeviceDurationStat[]>([]);
  const [activeLoading, setActiveLoading] = useState<boolean>(false);
  const [totalLoading, setTotalLoading] = useState<boolean>(false);
  const [durationLoading, setDurationLoading] = useState<boolean>(false);
  // 为每个图表创建独立的筛选参数
  const [activePoint, setActivePoint] = useState<number>(0); // 活跃设备数据类型
  const [activeType, setActiveType] = useState<number>(1); // 活跃设备统计周期
  const [totalPoint, setTotalPoint] = useState<number>(0); // 累计设备数据类型
  const [totalType, setTotalType] = useState<number>(1); // 累计设备统计周期
  const [activeModel, setActiveModel] = useState<string>('PFDM MR');
  const [totalModel, setTotalModel] = useState<string>('PFDM MR');
  const [durationModel, setDurationModel] = useState<string>('PFDM MR');
  const [durationPoint, setDurationPoint] = useState<number>(0);
  const [durationType, setDurationType] = useState<number>(1);
  const [durationMode, setDurationMode] = useState<DurationMode>('cumulative');
  const [activeMode, setActiveMode] = useState<ActiveMode>('activity');
  const navigate = useNavigate();
  const durationTitle = durationMode === 'average' ? '设备平均使用时长统计' : '设备累计使用时长统计';
  const durationToggleText = durationMode === 'average' ? '切换-累计使用时长' : '切换-平均使用时长';
  const durationLineName = durationMode === 'average' ? '平均使用时长（小时）' : '使用时长（小时）';
  const durationTooltipLabel = durationMode === 'average' ? '平均使用时长' : '使用时长';
  const activeTitle = activeMode === 'rate' ? '设备活跃率统计' : '设备活跃度统计';
  const activeToggleText = activeMode === 'rate' ? '切换-活跃度' : '切换-活跃率';

  // 补全累计激活量数据（往前追溯）
  const fillCumulativeData = (distributiveData: ApiStatData[], cumulativeData: ApiStatData[]): ApiStatData[] => {
    // 创建累计数据的日期映射
    const cumulativeMap = new Map<string, number>();
    cumulativeData.forEach(item => {
      cumulativeMap.set(item.activeDate, item.activeCount);
    });

    // 按日期排序累计数据（从早到晚）
    const sortedCumulative = [...cumulativeData].sort((a, b) => 
      new Date(a.activeDate).getTime() - new Date(b.activeDate).getTime()
    );

    // 为每个活跃度日期补全累计数据
    const filledData: ApiStatData[] = [];
    distributiveData.forEach(item => {
      const date = item.activeDate;
      const dateTime = new Date(date).getTime();
      
      if (cumulativeMap.has(date)) {
        // 如果累计数据中有该日期，直接使用
        filledData.push({
          activeDate: date,
          activeCount: cumulativeMap.get(date)!
        });
      } else {
        // 如果没有，往前追溯找到最近的一个小于等于当前日期的累计值
        let found = false;
        let lastCumulativeValue = 0;
        
        // 从后往前遍历，找到最后一个小于等于当前日期的累计值
        for (let i = sortedCumulative.length - 1; i >= 0; i--) {
          const cumDate = sortedCumulative[i].activeDate;
          const cumDateTime = new Date(cumDate).getTime();
          
          if (cumDateTime <= dateTime) {
            lastCumulativeValue = sortedCumulative[i].activeCount;
            found = true;
            break;
          }
        }
        
        filledData.push({
          activeDate: date,
          activeCount: found ? lastCumulativeValue : 0
        });
      }
    });

    return filledData;
  };

  // 计算活跃率数据
  const calculateActiveRate = (distributiveData: ApiStatData[], cumulativeData: ApiStatData[]): ActiveRateData[] => {
    const filledCumulative = fillCumulativeData(distributiveData, cumulativeData);
    const rateData: ActiveRateData[] = [];

    distributiveData.forEach((item, index) => {
      const cumulativeCount = filledCumulative[index]?.activeCount || 0;
      const rate = cumulativeCount > 0 ? (item.activeCount / cumulativeCount) * 100 : 0;
      rateData.push({
        activeDate: item.activeDate,
        activeRate: Number(rate.toFixed(2))
      });
    });

    return rateData;
  };

  // 获取设备活跃度数据
  const fetchActiveData = useCallback(async () => {
    setActiveLoading(true);
    try {
      const activeParams = {
        model: activeModel,
        point: activePoint,
        type: activeType
      };
      
      if (activeMode === 'activity') {
        // 活跃度模式：只调用活跃度接口
        const activeResponse = await axios.post<DeviceAtvResponse>(API.DEVICE_ACTIVITY, activeParams, getAxiosConfig());

        // 处理设备活跃度数据
        if (activeResponse.data.errCode === 0 && activeResponse.data.data?.atvs) {
          setActiveStats(activeResponse.data.data.atvs);
        } else {
          message.error('获取设备活跃度数据失败');
          setActiveStats([]);
        }
      } else {
        // 活跃率模式：同时调用两个接口
        const [activeResponse, cumulativeResponse] = await Promise.all([
          axios.post<DeviceAtvResponse>(API.DEVICE_ACTIVITY, activeParams, getAxiosConfig()),
          axios.post<DeviceAtvResponse>(API.DEVICE_TOTAL, activeParams, getAxiosConfig())
        ]);

        if (activeResponse.data.errCode === 0 && activeResponse.data.data?.atvs &&
            cumulativeResponse.data.errCode === 0 && cumulativeResponse.data.data?.atvs) {
          // 计算活跃率
          const rateData = calculateActiveRate(
            activeResponse.data.data.atvs,
            cumulativeResponse.data.data.atvs
          );
          setActiveRateStats(rateData);
        } else {
          message.error('获取设备活跃率数据失败');
          setActiveRateStats([]);
        }
      }
    } catch (error) {
      console.error('获取设备活跃度数据失败:', error);
      message.error('获取设备活跃度数据失败，请重试');
      if (activeMode === 'activity') {
        setActiveStats([]);
      } else {
        setActiveRateStats([]);
      }
    } finally {
      setActiveLoading(false);
    }
  }, [activePoint, activeType, activeModel, activeMode]);

  // 获取设备累计激活量数据
  const fetchTotalData = useCallback(async () => {
    setTotalLoading(true);
    try {
      const totalParams = {
        model: totalModel,
        point: totalPoint,
        type: totalType
      };
      
      const totalResponse = await axios.post<DeviceAtvResponse>(API.DEVICE_TOTAL, totalParams, getAxiosConfig());

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
  }, [totalPoint, totalType, totalModel]);

  // 按当前筛选条件获取数据
  useEffect(() => {
    fetchActiveData();
  }, [fetchActiveData]);
  
  useEffect(() => {
    fetchTotalData();
  }, [fetchTotalData]);

  // 获取设备使用时长数据
  const fetchDurationData = useCallback(async () => {
    setDurationLoading(true);
    try {
      const durationParams = {
        model: durationModel,
        point: durationPoint,
        type: durationType
      };

      const durationApi = durationMode === 'average' ? API.DEVICE_DURATION_AVG : API.DEVICE_DURATION;
      const durationResponse = await axios.post<DeviceDurationResponse>(durationApi, durationParams, getAxiosConfig());

      if (durationResponse.data.errCode === 0 && durationResponse.data.data?.durs) {
        setDurationStats(durationResponse.data.data.durs);
      } else {
        message.error('获取设备使用时长数据失败');
        setDurationStats([]);
      }
    } catch (error) {
      console.error('获取设备使用时长数据失败:', error);
      message.error('获取设备使用时长数据失败，请重试');
      setDurationStats([]);
    } finally {
      setDurationLoading(false);
    }
  }, [durationModel, durationPoint, durationType, durationMode]);

  useEffect(() => {
    fetchDurationData();
  }, [fetchDurationData]);
  
  // 手动刷新设备活跃度数据
  const handleActiveRefresh = () => {
    fetchActiveData();
  };

  // 手动刷新设备累计激活数据
  const handleTotalRefresh = () => {
    fetchTotalData();
  };

  const handleDurationRefresh = () => {
    fetchDurationData();
  };

  const handleDurationModeToggle = () => {
    setDurationMode((prev) => (prev === 'cumulative' ? 'average' : 'cumulative'));
  };

  const handleActiveModeToggle = () => {
    setActiveMode((prev) => {
      const newMode = prev === 'activity' ? 'rate' : 'activity';
      // 切换模式时清空旧数据
      if (newMode === 'activity') {
        setActiveRateStats([]);
      } else {
        setActiveStats([]);
      }
      return newMode;
    });
  };

  // 退出登录
  const handleLogout = () => {
    sessionStorage.removeItem('token');
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
                <Text strong>设备类型：</Text>
                <Select
                  value={totalModel}
                  style={{ width: 160, marginLeft: 10 }}
                  onChange={(value) => setTotalModel(value)}
                >
                  {DEVICE_MODEL_OPTIONS.map((option) => (
                    <Option key={option} value={option}>
                      {option}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="filter-item">
                <Text strong>数据类型：</Text>
                <Select 
                  value={totalPoint}
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
                  value={totalType}
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

          {/* 设备活跃度统计 */}
          <Card 
            className="stats-card" 
            title={activeTitle}
            extra={
              <Button type="link" onClick={handleActiveModeToggle}>
                {activeToggleText}
              </Button>
            }
          >
            <div className="chart-filter-controls">
              <div className="filter-item">
                <Text strong>设备类型：</Text>
                <Select
                  value={activeModel}
                  style={{ width: 160, marginLeft: 10 }}
                  onChange={(value) => setActiveModel(value)}
                >
                  {DEVICE_MODEL_OPTIONS.map((option) => (
                    <Option key={option} value={option}>
                      {option}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="filter-item">
                <Text strong>数据类型：</Text>
                <Select 
                  value={activePoint}
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
                  value={activeType}
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
            ) : activeMode === 'activity' ? (
              activeStats.length > 0 ? (
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
              )
            ) : (
              activeRateStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={activeRateStats}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="activeDate" />
                    <YAxis unit="%" />
                    <Tooltip formatter={(value: number) => [`${value}%`, '活跃率']} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="activeRate" 
                      name="活跃率（%）" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无数据" />
              )
            )}
          </Card>

          {/* 设备使用时长统计 */}
          <Card 
            className="stats-card" 
            title={durationTitle}
            extra={
              <Button type="link" onClick={handleDurationModeToggle}>
                {durationToggleText}
              </Button>
            }
          >
            <div className="chart-filter-controls">
              <div className="filter-item">
                <Text strong>设备类型：</Text>
                <Select
                  value={durationModel}
                  style={{ width: 160, marginLeft: 10 }}
                  onChange={(value) => setDurationModel(value)}
                >
                  {DEVICE_MODEL_OPTIONS.map((option) => (
                    <Option key={option} value={option}>
                      {option}
                    </Option>
                  ))}
                </Select>
              </div>
              <div className="filter-item">
                <Text strong>数据类型：</Text>
                <Select
                  value={durationPoint}
                  style={{ width: 120, marginLeft: 10 }}
                  onChange={(value) => setDurationPoint(value)}
                >
                  <Option value={0}>全部</Option>
                  <Option value={1}>C端</Option>
                  <Option value={2}>B端</Option>
                </Select>
              </div>
              <div className="filter-item">
                <Text strong>统计周期：</Text>
                <Select
                  value={durationType}
                  style={{ width: 120, marginLeft: 10 }}
                  onChange={(value) => setDurationType(value)}
                >
                  <Option value={1}>日</Option>
                  <Option value={2}>周</Option>
                  <Option value={3}>月</Option>
                </Select>
              </div>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleDurationRefresh}
                loading={durationLoading}
                style={{ marginLeft: 10 }}
              >
                刷新
              </Button>
            </div>
            {durationLoading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : durationStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={durationStats}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="useDate" />
                  <YAxis unit="h" />
                  <Tooltip formatter={(value: number) => [`${value} 小时`, durationTooltipLabel]} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="useDuration"
                    name={durationLineName}
                    stroke="#ff7300"
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