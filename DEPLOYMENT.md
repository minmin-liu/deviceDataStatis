# DRM密钥管理系统部署说明

## 一、项目构建

在将项目部署到服务端之前，首先需要进行构建：

1. 确保已安装依赖：
```bash
npm install
```

2. 执行构建命令：
```bash
npm run build
```

构建完成后，会在项目根目录生成 `dist` 文件夹，包含所有需要部署的静态文件。

## 二、部署到服务端

### 方法1：Nginx部署（推荐）

1. 安装Nginx

2. 配置Nginx：

编辑Nginx配置文件（通常在 `/etc/nginx/nginx.conf` 或 `/etc/nginx/conf.d/default.conf`）：

```nginx
server {
    listen 80;
    server_name your-domain.com; # 替换为您的域名

    # 配置SSL（如果需要HTTPS）
    # listen 443 ssl;
    # ssl_certificate /path/to/your/cert.pem;
    # ssl_certificate_key /path/to/your/key.pem;

    root /path/to/your/dist; # 指向dist文件夹的路径
    index index.html;
    
    # 确保正确的MIME类型配置 - 这是解决Failed to load module script错误的关键
    types {
        application/javascript js;
        text/javascript js;
        text/css css;
        application/json json;
    }

    location / {
        try_files $uri $uri/ /index.html; # 支持SPA路由
        # 确保所有JavaScript文件都有正确的MIME类型
        add_header Content-Type application/javascript "application/javascript";
    }

    # 明确处理assets目录中的JavaScript文件
    location ~* \.(js)$ {
        root /path/to/your/dist;
        add_header Content-Type application/javascript;
        expires max;
    }

    # API代理配置（如果后端API不在同一域）
    location /api {
        proxy_pass https://your-api-server.com; # 替换为实际的API地址
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. 重启Nginx：
```bash
nginx -s reload
```

### 方法2：使用Node.js服务器（如Express）

1. 创建一个简单的Express服务器：

```javascript
// server.js
const express = require('express');
const path = require('path');
const proxy = require('http-proxy-middleware');

const app = express();

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

// API代理
app.use('/api', proxy({
  target: 'https://your-api-server.com', // 替换为实际的API地址
  changeOrigin: true
}));

// 支持SPA路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

2. 安装依赖并启动：
```bash
npm install express http-proxy-middleware
node server.js
```

## 三、修改API地址

根据实际部署环境，修改 `vite.config.ts` 中的API代理配置。

## 四、解决MIME类型错误

如果遇到 "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html"" 错误，这通常是由于以下原因导致：

1. **服务器MIME类型配置不正确**：
   - 确保您的Web服务器正确配置了JavaScript文件的MIME类型
   - 对于Nginx，配置如上述示例
   - 对于Apache，请在`.htaccess`文件中添加：
   ```apache
   <IfModule mod_mime.c>
     AddType application/javascript .js
     AddType text/css .css
     AddType application/json .json
   </IfModule>
   ```

2. **文件路径问题**：
   - 我们已在 `vite.config.ts` 中设置了 `base: './'` 以使用相对路径
   - 确保部署路径正确，所有资源文件都可以被正确访问

3. **服务器配置检查**：
   - 检查服务器日志以确认文件是否存在
   - 确认服务器用户有足够权限读取静态文件
   - 对于SPA应用，确保所有未匹配的URL都重定向到index.html

4. **Nginx特定问题**：
   - 确保没有其他配置覆盖了MIME类型设置
   - 检查`/etc/nginx/mime.types`文件是否包含正确的JavaScript MIME类型

本项目提供了统一的API配置管理，修改API地址非常简单：

### 修改生产环境API地址

编辑 `src/config/api.ts` 文件：

```typescript
// 修改这一行，将其替换为实际的API地址
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? '/api' 
  : 'https://your-api-server.com'; // 替换为真实的生产环境API地址
```

修改后需要重新构建项目：
```bash
npm run build
```

### 使用环境变量（推荐）

更灵活的方式是使用环境变量。创建 `.env.production` 文件：

```
VITE_API_BASE_URL=https://your-api-server.com
```

然后修改 `src/config/api.ts` 文件：

```typescript
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? '/api' 
  : (import.meta.env.VITE_API_BASE_URL || 'https://default-api-server.com');
```

## 四、部署注意事项

1. **HTTPS配置**：为了安全起见，建议在生产环境中配置HTTPS。

2. **CORS设置**：确保后端API服务器配置了正确的CORS策略，允许前端域名访问。

3. **Token安全**：确保JWT token的安全存储和传输。

4. **错误处理**：生产环境中建议添加全局错误处理机制，避免敏感错误信息泄露。

5. **性能优化**：考虑对静态资源进行CDN加速、启用gzip压缩等优化措施。

6. **日志监控**：添加适当的日志记录和监控机制，以便及时发现和解决问题。