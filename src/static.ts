export const DEFAULT = {
  REGION: 'cn-hangzhou',
  SERVICE: {
    Name: 's-service',
    Description: 'This Service Powered By Serverless Devs Tool'
  },
  FUNCTION: {
    Name: `s-function-${new Date().getTime()}`,
    Description: 'This Function Powered By Serverless Devs Tool',
    Handler: 'index.handler',
    MemorySize: 128,
    Runtime: 'custom',
    Timeout: 10
  },
  TRIGGERS: [{
    Name: 'http',
    Type: 'HTTP',
    Parameters: {
      AuthType: 'ANONYMOUS',
      Methods: ['GET', 'POST', 'PUT'],
      Domains: []
    }
  }],
  DOMAINS: [{
    Domain: 'Auto',
    Routes: [{
      Path: '/*',
      Qualifier: 'LATEST'
    }]
  }]
};