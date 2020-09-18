# Serverless Devs Tool Alibaba Cloud 框架核心组件库

## 前言
该组件库是Serverless Devs Tool针对阿里云函数计算制作的框架核心组件库。

通过该组件库，您可以简单快速的部署一个上层应用。

## 使用方法

该组件库实底层依赖Serverless Devs Tool的fc-alibaba组件库，所支持的能力主要包括部署，移除等操作。

以部署为例：

- 导入组件库

    ```typescript
    import Framework = require('@serverless-devs/s-framework');
    ```
 
- 使用组件进行部署

    ```typescript
    class NuxtComponent extends Framework {
      async deploy(inputs: InputsContext) {
        return await super.deploy(inputs);
      }
    }
    ```

## 联系我们

- 社区网站：www.serverlessfans.com
- 社区邮箱：service@serverlessfans.com